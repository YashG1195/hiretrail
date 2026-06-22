/**
 * Global error handling middleware.
 * Must be registered LAST in Express (after all routes).
 */
export const errorHandler = (err, req, res, next) => {
  // Log full error in development, minimal in production
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`);
    console.error(err.stack);
  } else {
    console.error(`[ERROR] ${err.message}`);
  }

  // ── Mongoose Validation Error ──────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors,
    });
  }

  // ── Mongoose Duplicate Key ─────────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // ── Mongoose Cast Error (invalid ObjectId) ────────────────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid value for field: ${err.path}`,
    });
  }

  // ── JWT Errors ─────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // ── Multer Errors (Phase 4) ────────────────────────────────────────────────
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  // ── Default: 500 Internal Server Error ────────────────────────────────────
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : err.message || 'Internal server error',
  });
};

/**
 * Helper to create structured application errors with HTTP status codes.
 * Usage: throw createError(404, 'Job not found')
 */
export const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};
