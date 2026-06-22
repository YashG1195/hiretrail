import mongoose from 'mongoose';
import path from 'path';
import Resume from '../models/Resume.js';
import { resumeQueue } from '../queues/resumeQueue.js';

// ─── POST /api/resumes/upload ─────────────────────────────────────────────────
/**
 * Accepts a PDF/DOCX file via multipart/form-data (field: "resume").
 * Saves metadata to Resume model, enqueues BullMQ parse job.
 * Returns 202 immediately — parsing happens asynchronously.
 */
export const uploadResume = async (req, res, next) => {
  try {
    // multer handleUpload middleware populates req.file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Include a file under the "resume" field.',
      });
    }

    const { originalname, filename, path: filePath, mimetype, size } = req.file;

    // ── Save metadata to MongoDB ───────────────────────────────────────────────
    const resume = await Resume.create({
      userId: req.user.id,
      fileName: filename,
      originalName: originalname,
      fileUrl: filePath,   // local path; swap to S3 URL in production
      mimeType: mimetype,
      fileSize: size,
      parseStatus: 'pending',
    });

    // ── Enqueue BullMQ parse job ───────────────────────────────────────────────
    const job = await resumeQueue.add(
      'parse-resume',
      {
        resumeId: resume._id.toString(),
        filePath: filePath,
        mimeType: mimetype,
      },
      {
        jobId: resume._id.toString(), // deduplicate by resumeId
      }
    );

    console.log(`📤 [Resume] Enqueued parse job ${job.id} for resume ${resume._id}`);

    // ── Return 202 Accepted immediately ───────────────────────────────────────
    return res.status(202).json({
      success: true,
      message: 'Resume uploaded. Parsing in progress.',
      resumeId: resume._id,
      parseStatus: 'pending',
      jobId: job.id,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/resumes/:id ─────────────────────────────────────────────────────
/**
 * Returns resume metadata + current parse status.
 * User can only access their own resumes.
 */
export const getResumeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid resume ID' });
    }

    const resume = await Resume.findOne(
      { _id: id, userId: req.user.id },
      // Exclude raw extractedText from this endpoint (can be large)
      { extractedText: 0 }
    ).populate('userId', 'name email');

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    return res.status(200).json({ success: true, resume });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/resumes ─────────────────────────────────────────────────────────
/**
 * List all resumes for the authenticated user (most recent first).
 */
export const listResumes = async (req, res, next) => {
  try {
    const resumes = await Resume.find(
      { userId: req.user.id },
      { extractedText: 0 }       // exclude large text field from list
    ).sort({ uploadedAt: -1 });

    return res.status(200).json({ success: true, count: resumes.length, resumes });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/resumes/:id ──────────────────────────────────────────────────
/**
 * Soft-deletes a resume by marking isActive: false.
 */
export const deleteResume = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid resume ID' });
    }

    const resume = await Resume.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }

    return res.status(200).json({ success: true, message: 'Resume removed' });
  } catch (err) {
    next(err);
  }
};
