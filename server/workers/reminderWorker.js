import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { sendEmail, followUpReminderTemplate } from '../services/mailer.js';

// ─── BullMQ Redis Connection ──────────────────────────────────────────────────
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// ─── Statuses that no longer need follow-up reminders ─────────────────────────
const TERMINAL_STATUSES = new Set(['offer', 'rejected', 'withdrawn']);

// ─── Process Function ─────────────────────────────────────────────────────────

const processReminder = async (job) => {
  const { jobId, userId } = job.data;

  console.log(
    `📬 [ReminderWorker] Processing job ${job.id} | jobId: ${jobId} | attempt: ${job.attemptsMade + 1}`
  );

  // ── Fetch Job document ────────────────────────────────────────────────────
  const jobDoc = await Job.findOne({
    _id: jobId,
    deletedAt: null,
  }).select('companyName jobTitle status appliedDate userId');

  if (!jobDoc) {
    console.log(`⏭  [ReminderWorker] Job ${jobId} not found or deleted — skipping`);
    return { skipped: true, reason: 'job_not_found' };
  }

  // ── Skip terminal statuses ────────────────────────────────────────────────
  if (TERMINAL_STATUSES.has(jobDoc.status)) {
    console.log(
      `⏭  [ReminderWorker] Job ${jobId} is in terminal status "${jobDoc.status}" — skipping`
    );
    return { skipped: true, reason: `status_${jobDoc.status}` };
  }

  // ── Fetch User document ───────────────────────────────────────────────────
  const user = await User.findById(userId).select('name email');
  if (!user) {
    console.log(`⏭  [ReminderWorker] User ${userId} not found — skipping`);
    return { skipped: true, reason: 'user_not_found' };
  }

  // ── Compute days since applied ────────────────────────────────────────────
  const daysSinceApplied = Math.floor(
    (Date.now() - new Date(jobDoc.appliedDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // ── Build CTA URL ─────────────────────────────────────────────────────────
  const ctaUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/jobs/${jobId}`;

  // ── Render email template ─────────────────────────────────────────────────
  const html = followUpReminderTemplate({
    userName:        user.name,
    companyName:     jobDoc.companyName,
    jobTitle:        jobDoc.jobTitle,
    status:          jobDoc.status,
    daysSinceApplied,
    ctaUrl,
  });

  const subject = `⏰ Follow up on your ${jobDoc.companyName} application — HireTrail`;

  // ── Send email ────────────────────────────────────────────────────────────
  const result = await sendEmail(user.email, subject, html);

  // ── Update lastReminderSentAt on Job ─────────────────────────────────────
  await Job.findByIdAndUpdate(jobId, {
    $set: { lastReminderSentAt: new Date() },
  });

  console.log(
    `✅ [ReminderWorker] Reminder sent to ${user.email} for job ${jobId}` +
    (result.skipped ? ' (SMTP not configured — logged only)' : ` | msgId: ${result.messageId}`)
  );

  return { sent: !result.skipped, email: user.email, jobId };
};

// ─── Worker Instance ──────────────────────────────────────────────────────────
let worker;

export const startReminderWorker = () => {
  worker = new Worker('reminders', processReminder, {
    connection,
    concurrency: 5,       // I/O-bound (email) — higher concurrency is fine
    lockDuration: 30_000, // 30 seconds
  });

  worker.on('completed', (job, result) => {
    if (result.skipped) {
      console.log(`⏭  [ReminderWorker] Job ${job.id} skipped: ${result.reason}`);
    } else {
      console.log(`✅ [ReminderWorker] Job ${job.id} completed | email: ${result.email}`);
    }
  });

  worker.on('failed', (job, err) => {
    console.error(
      `❌ [ReminderWorker] Job ${job?.id} failed ` +
      `(attempt ${job?.attemptsMade}/${job?.opts?.attempts ?? 3}): ${err.message}`
    );
  });

  worker.on('error', (err) => {
    console.error('❌ [ReminderWorker] Worker error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`⚠️  [ReminderWorker] Job ${jobId} stalled`);
  });

  console.log('📬 [ReminderWorker] Reminder Worker started with concurrency: 5');
  return worker;
};

export default startReminderWorker;
