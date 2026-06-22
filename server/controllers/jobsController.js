import mongoose from 'mongoose';
import Job from '../models/Job.js';
import { createJobSchema, updateJobSchema, listJobsQuerySchema } from '../validators/jobValidators.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Encodes cursor object to base64 string.
 * @param {{ appliedDate: Date, _id: string }} cursorData
 */
const encodeCursor = (cursorData) =>
  Buffer.from(JSON.stringify(cursorData)).toString('base64');

/**
 * Decodes base64 cursor string to object.
 * Returns null if invalid.
 */
const decodeCursor = (cursor) => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

// ─── POST /api/jobs ───────────────────────────────────────────────────────────
/**
 * Create a new job application entry.
 */
export const createJob = async (req, res, next) => {
  try {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const job = await Job.create({
      ...parsed.data,
      userId: req.user.id,
    });

    // Populate user info (name + email only, no passwordHash)
    await job.populate('userId', 'name email');

    return res.status(201).json({
      success: true,
      message: 'Job application created',
      job,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/jobs ────────────────────────────────────────────────────────────
/**
 * List job applications with filters + cursor-based pagination.
 * Filters: status, tag, search (company/title text), dateRange (appliedDate).
 * Sort: appliedDate desc, _id desc (stable compound sort).
 * Pagination: cursor = base64({ appliedDate, _id }) of last item.
 */
export const listJobs = async (req, res, next) => {
  try {
    const parsed = listJobsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { status, tag, search, startDate, endDate, cursor, limit } = parsed.data;

    // ── Build filter ─────────────────────────────────────────────────────────
    const filter = {
      userId: req.user.id,
      deletedAt: null, // exclude soft-deleted
    };

    if (status) filter.status = status;
    if (tag) filter.tags = tag;

    // Date range on appliedDate
    if (startDate || endDate) {
      filter.appliedDate = {};
      if (startDate) filter.appliedDate.$gte = startDate;
      if (endDate) filter.appliedDate.$lte = endDate;
    }

    // Full-text search on companyName + jobTitle (MongoDB text index)
    if (search) {
      filter.$text = { $search: search };
    }

    // ── Cursor decode ─────────────────────────────────────────────────────────
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded || !decoded.appliedDate || !decoded._id) {
        return res.status(400).json({ success: false, message: 'Invalid pagination cursor' });
      }

      const cursorDate = new Date(decoded.appliedDate);
      const cursorId = new mongoose.Types.ObjectId(decoded._id);

      // Compound cursor: get items older than last seen (appliedDate desc, _id desc)
      filter.$or = [
        { appliedDate: { $lt: cursorDate } },
        {
          appliedDate: cursorDate,
          _id: { $lt: cursorId },
        },
      ];
    }

    // ── Query ─────────────────────────────────────────────────────────────────
    const jobs = await Job.find(filter)
      .populate('userId', 'name email')
      .sort({ appliedDate: -1, _id: -1 })
      .limit(limit + 1) // fetch one extra to determine if next page exists
      .lean();

    // ── Build response with nextCursor ────────────────────────────────────────
    const hasNextPage = jobs.length > limit;
    const data = hasNextPage ? jobs.slice(0, limit) : jobs;

    let nextCursor = null;
    if (hasNextPage) {
      const last = data[data.length - 1];
      nextCursor = encodeCursor({ appliedDate: last.appliedDate, _id: last._id });
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      hasNextPage,
      nextCursor,
      jobs: data,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/jobs/:id ────────────────────────────────────────────────────────
/**
 * Get a single job by ID — must belong to the authenticated user.
 */
export const getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID' });
    }

    const job = await Job.findOne({
      _id: id,
      userId: req.user.id,
      deletedAt: null,
    }).populate('userId', 'name email');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.status(200).json({ success: true, job });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/jobs/:id ──────────────────────────────────────────────────────
/**
 * Partially update a job application.
 * Only the owner (req.user.id) can update their own jobs.
 */
export const updateJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID' });
    }

    const parsed = updateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    const job = await Job.findOneAndUpdate(
      { _id: id, userId: req.user.id, deletedAt: null },
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).populate('userId', 'name email');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      job,
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/jobs/:id ─────────────────────────────────────────────────────
/**
 * Soft-delete a job application (sets deletedAt timestamp).
 * The record is retained in DB for audit/report purposes.
 */
export const deleteJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID' });
    }

    const job = await Job.findOneAndUpdate(
      { _id: id, userId: req.user.id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Job application deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/jobs/stats ──────────────────────────────────────────────────────
/**
 * Aggregate stats for the dashboard — count per status.
 */
export const getJobStats = async (req, res, next) => {
  try {
    const stats = await Job.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id), deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } },
    ]);

    // Normalize into { applied: N, phone_screen: N, ... }
    const normalized = {
      applied: 0,
      phone_screen: 0,
      technical: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    };
    stats.forEach(({ status, count }) => {
      normalized[status] = count;
    });

    const total = Object.values(normalized).reduce((sum, n) => sum + n, 0);

    return res.status(200).json({ success: true, total, byStatus: normalized });
  } catch (err) {
    next(err);
  }
};
