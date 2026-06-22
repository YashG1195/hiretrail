import mongoose from 'mongoose';
import Job from '../models/Job.js';
import Resume from '../models/Resume.js';
import { createJobSchema, updateJobSchema, listJobsQuerySchema } from '../validators/jobValidators.js';
import { atsQueue } from '../queues/atsQueue.js';
import { scheduleFollowUpReminder } from '../services/reminderService.js';

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

// ─── POST /api/jobs ───────────────────────────────────────────────────────────────
/**
 * Create a new job application entry.
 * Automatically schedules a 7-day follow-up reminder.
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

    // ── Auto-schedule 7-day follow-up reminder (fire-and-forget) ────────────────
    scheduleFollowUpReminder(job._id, req.user.id, 7).catch((err) =>
      console.error(`[createJob] Failed to schedule reminder for job ${job._id}: ${err.message}`)
    );

    return res.status(201).json({
      success: true,
      message: 'Job application created',
      reminderScheduled: '7 days',
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

// ─── POST /api/jobs/:id/analyze ──────────────────────────────────────────────────────────
/**
 * Enqueue an ATS scoring job for this job application.
 * Body: { resumeId: string }
 *
 * Validates:
 *  - Job belongs to req.user
 *  - Job has a jobDescription
 *  - Resume belongs to req.user and has extractedText (parseStatus === 'done')
 */
export const analyzeJob = async (req, res, next) => {
  try {
    const { id: jobId } = req.params;
    const { resumeId } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID' });
    }
    if (!resumeId || !mongoose.Types.ObjectId.isValid(resumeId)) {
      return res.status(400).json({ success: false, message: 'Valid resumeId is required in request body' });
    }

    // ── Verify job ownership + jobDescription exists ─────────────────────────
    const job = await Job.findOne({ _id: jobId, userId: req.user.id, deletedAt: null })
      .select('jobDescription companyName jobTitle');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    if (!job.jobDescription || job.jobDescription.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Job must have a jobDescription (at least 20 characters) before ATS analysis',
      });
    }

    // ── Verify resume belongs to user and is parsed ──────────────────────────
    const resume = await Resume.findOne({ _id: resumeId, userId: req.user.id })
      .select('parseStatus extractedText fileName');
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    if (resume.parseStatus !== 'done' || !resume.extractedText) {
      return res.status(400).json({
        success: false,
        message: `Resume is not ready for analysis. Current parse status: "${resume.parseStatus}"`,
        parseStatus: resume.parseStatus,
      });
    }

    // ── Enqueue ATS scoring job ──────────────────────────────────────────────
    const queueJob = await atsQueue.add(
      'score-resume',
      { jobId: jobId.toString(), resumeId: resumeId.toString() },
      {
        jobId: `ats:${jobId}:${resumeId}`, // deduplicate by job+resume pair
      }
    );

    console.log(`📊 [ATS] Enqueued scoring job ${queueJob.id} for job ${jobId} x resume ${resumeId}`);

    return res.status(202).json({
      success: true,
      message: 'ATS analysis queued. Results will be available shortly.',
      queueJobId: queueJob.id,
      jobId,
      resumeId,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/jobs/:id/ats-result ──────────────────────────────────────────────────────────
/**
 * Return the current ATS score, matched keywords, and gap keywords for a job.
 * Returns null fields if analysis hasn't run yet.
 */
export const getAtsResult = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID' });
    }

    const job = await Job.findOne(
      { _id: id, userId: req.user.id, deletedAt: null },
      // Select only ATS fields + job identifiers for the response
      {
        companyName: 1,
        jobTitle: 1,
        atsScore: 1,
        atsKeywordsMatched: 1,
        atsKeywordGaps: 1,
        updatedAt: 1,
      }
    );

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const hasResult = job.atsScore !== null && job.atsScore !== undefined;

    return res.status(200).json({
      success: true,
      hasResult,
      job: {
        _id: job._id,
        companyName: job.companyName,
        jobTitle: job.jobTitle,
        atsScore: job.atsScore ?? null,
        matchedKeywords: job.atsKeywordsMatched ?? [],
        gapKeywords: job.atsKeywordGaps ?? [],
        lastAnalyzedAt: hasResult ? job.updatedAt : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/jobs/:id/remind ────────────────────────────────────────────────
/**
 * Manually schedule (or re-schedule) a follow-up reminder for a job.
 * Body: { delayDays?: number }  — defaults to 0 (immediate) if not provided.
 *
 * Use cases:
 *  - User wants to snooze and get reminded again in N days
 *  - User manually triggers a reminder outside the 7-day auto-schedule
 */
export const triggerReminder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const delayDays = Number(req.body?.delayDays ?? 0);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid job ID' });
    }

    if (isNaN(delayDays) || delayDays < 0 || delayDays > 365) {
      return res.status(400).json({
        success: false,
        message: 'delayDays must be a number between 0 and 365',
      });
    }

    // Verify ownership + job is not deleted or terminal
    const job = await Job.findOne({
      _id: id,
      userId: req.user.id,
      deletedAt: null,
    }).select('companyName jobTitle status');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const TERMINAL_STATUSES = ['offer', 'rejected', 'withdrawn'];
    if (TERMINAL_STATUSES.includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot schedule a reminder for a job with status "${job.status}"`,
      });
    }

    const bullJob = await scheduleFollowUpReminder(id, req.user.id, delayDays);

    const delayLabel =
      delayDays === 0 ? 'immediately' : `in ${delayDays} day${delayDays === 1 ? '' : 's'}`;

    return res.status(202).json({
      success: true,
      message: `Reminder scheduled — will send ${delayLabel}`,
      queueJobId: bullJob.id,
      delayDays,
    });
  } catch (err) {
    next(err);
  }
};
