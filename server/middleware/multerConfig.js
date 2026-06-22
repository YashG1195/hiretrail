import multer, { diskStorage, MulterError } from 'multer';
import path from 'path';
import fs from 'fs';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);

// ─── Disk Storage ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // req.user is attached by authMiddleware before this runs
    const userId = req.user?.id || 'anonymous';
    const uploadDir = path.join(process.cwd(), 'uploads', userId);

    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    const timestamp = Date.now();
    // Sanitize original filename — replace any non-alphanumeric (except . - _) with _
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

// ─── File Filter — MIME type + extension double-check ─────────────────────────
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.has(ext);

  if (mimeOk && extOk) {
    return cb(null, true);
  }

  const err = new Error(
    `Invalid file type. Only PDF and DOCX files are accepted. Received: ${file.mimetype} (${ext || 'no extension'})`
  );
  err.status = 400;
  err.code = 'INVALID_FILE_TYPE';
  cb(err, false);
};

// ─── Multer instance ──────────────────────────────────────────────────────────
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// ─── Multer error handler wrapper ─────────────────────────────────────────────
// Converts multer's internal errors to clean 400 JSON responses.
// Usage: router.post('/upload', handleUpload, controller)
export const handleUpload = (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (!err) return next();

    // Multer-specific errors (file size, unexpected field, etc.)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field. Use "resume" as the form-data field name.',
      });
    }

    if (err.code === 'INVALID_FILE_TYPE') {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Other errors (disk write failures, etc.)
    next(err);
  });
};
