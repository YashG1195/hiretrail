import jwt from 'jsonwebtoken';

/**
 * authMiddleware
 * Verifies the Bearer access token from the Authorization header.
 * Attaches req.user = { id, role } on success.
 */
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid access token',
    });
  }
};

/**
 * requireRole(...roles)
 * Role-based access control middleware — use after authMiddleware.
 * Example: router.delete('/users/:id', authMiddleware, requireRole('admin'), ...)
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient permissions',
      });
    }
    next();
  };
};
