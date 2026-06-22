import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },

    // ── File Info ────────────────────────────────────────────────────────────
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    originalName: {
      type: String,
      trim: true,
      default: null,
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true,
      // local path in dev (e.g. /uploads/filename.pdf), S3 URL in production
    },
    mimeType: {
      type: String,
      default: 'application/pdf',
    },
    fileSize: {
      type: Number, // bytes
      default: null,
    },

    // ── Parsed Content (populated by ResumeParserWorker in Phase 4) ──────────
    extractedText: {
      type: String,
      default: null,
      // Full raw text extracted from the PDF — used by ATS Analyzer in Phase 5
    },
    parseStatus: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
    },
    parseError: {
      type: String,
      default: null,
    },

    // ── Meta ─────────────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true, // users may have multiple resumes; only one active
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
resumeSchema.index({ userId: 1, uploadedAt: -1 });
resumeSchema.index({ userId: 1, isActive: 1 });

const Resume = mongoose.model('Resume', resumeSchema);
export default Resume;
