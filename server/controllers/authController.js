import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { getRedis } from '../config/redis.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

// ─── Zod Validation Schemas ───────────────────────────────────────────────────
const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token is required' }).min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateTokens = (userId, role) => {
  const payload = { sub: userId.toString(), role };

  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return { accessToken, refreshToken };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new user account.
 */
export const register = async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, password } = parsed.data;

    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await User.create({ name, email, passwordHash });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and issue JWT tokens.
 */
export const login = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;

    // Fetch user WITH passwordHash (select: false by default)
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.isActive) {
      // Generic message — don't reveal whether email exists
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    // Store refreshToken in Redis with 7-day TTL
    const redis = getRedis();
    await redis.set(`refresh:${user._id}`, refreshToken, 'EX', REFRESH_TTL_SECONDS);

    // Update lastLoginAt (fire-and-forget, no await)
    User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }).exec();

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Verify refreshToken from Redis and issue a new accessToken.
 */
export const refresh = async (req, res, next) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { refreshToken } = parsed.data;

    // Verify JWT signature and expiry
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // Validate against Redis — ensures token hasn't been revoked
    const redis = getRedis();
    const stored = await redis.get(`refresh:${payload.sub}`);
    if (!stored || stored !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked',
      });
    }

    // Issue new accessToken (refresh token rotation can be added later)
    const accessToken = jwt.sign(
      { sub: payload.sub, role: payload.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    return res.status(200).json({
      success: true,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Revoke the user's refreshToken from Redis.
 */
export const logout = async (req, res, next) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { refreshToken } = parsed.data;

    // Silently succeed even if token is already invalid/expired
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      // Token already invalid — treat as successful logout
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    }

    const redis = getRedis();
    await redis.del(`refresh:${payload.sub}`);

    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me  (protected)
 * Returns the currently authenticated user's profile.
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
