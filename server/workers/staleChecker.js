/**
 * workers/staleChecker.js
 *
 * A BullMQ repeatable worker that runs every day at 9:00 AM (cron: "0 9 * * *").
 * Scans for stale job applications and enqueues follow-up reminder emails.
 *
 * Stale criteria:
 *   - status === "applied"                     (still in initial state)
 *   - appliedDate < 14 days ago               (old enough to warrant follow-up)
 *   - lastReminderSentAt < 7 days ago OR null  (not emailed recently)
 *   - deletedAt === null                       (not soft-deleted)
 */

import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import Job from '../models/Job.js';
import { scheduleFollowUpReminder } from '../services/reminderService.js';

// ─── BullMQ Redis Connection ──────────────────────────────────────────────────
const createBullConnection = () =>
  new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

// ─── Stale Checker Queue ──────────────────────────────────────────────────────
// Separate queue so the cron trigger is isolated from the reminder delivery queue.
const staleCheckerQueue = new Queue('stale-checker', {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60_000 }, // retry after 1 min
    removeOnComplete: { age: 24 * 60 * 60, count: 7 },
    removeOnFail:     { age: 7 * 24 * 60 * 60 },
  },
});

staleCheckerQueue.on('error', (err) => {
  console.error('❌ [StaleChecker] Queue error:', err.message);
});

// ─── Stale detection thresholds ───────────────────────────────────────────────
const STALE_DAYS        = 14; // job must be at least 14 days old
const REMINDER_INTERVAL = 7;  // minimum days between reminders

// ─── Process Function ─────────────────────────────────────────────────────────

const processStaleCheck = async (job) => {
  const now = new Date();
  const staleThreshold    = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const reminderThreshold = new Date(now.getTime() - REMINDER_INTERVAL * 24 * 60 * 60 * 1000);

  console.log(
    `🔍 [StaleChecker] Running stale job scan at ${now.toISOString()}`
  );

  // ── Find stale applications ───────────────────────────────────────────────
  const staleJobs = await Job.find({
    status:      'applied',
    appliedDate: { $lt: staleThreshold },
    deletedAt:   null,
    $or: [
      { lastReminderSentAt: null },                         // never sent a reminder
      { lastReminderSentAt: { $lt: reminderThreshold } },  // last reminder > 7 days ago
    ],
  }).select('_id userId companyName jobTitle appliedDate lastReminderSentAt');

  if (staleJobs.length === 0) {
    console.log('✅ [StaleChecker] No stale jobs found');
    return { staleJobsFound: 0, remindersEnqueued: 0 };
  }

  console.log(`📋 [StaleChecker] Found ${staleJobs.length} stale job(s) — enqueuing reminders`);

  // ── Enqueue a reminder for each stale job (immediate delivery) ────────────
  let enqueued = 0;
  const errors = [];

  for (const staleJob of staleJobs) {
    try {
      await scheduleFollowUpReminder(
        staleJob._id,
        staleJob.userId,
        0 // delay = 0 → send immediately
      );
      enqueued++;
      console.log(
        `  → Enqueued reminder for job ${staleJob._id} | ${staleJob.companyName} | userId: ${staleJob.userId}`
      );
    } catch (err) {
      console.error(
        `  ❌ Failed to enqueue reminder for job ${staleJob._id}: ${err.message}`
      );
      errors.push({ jobId: staleJob._id.toString(), error: err.message });
    }
  }

  console.log(
    `✅ [StaleChecker] Done — enqueued: ${enqueued}/${staleJobs.length}` +
    (errors.length ? ` | errors: ${errors.length}` : '')
  );

  return { staleJobsFound: staleJobs.length, remindersEnqueued: enqueued, errors };
};

// ─── Start function ───────────────────────────────────────────────────────────

let staleWorker;

export const startStaleChecker = async () => {
  // ── Register the daily cron job (idempotent — safe to call on every restart) ─
  // BullMQ's repeat option deduplicates based on the job name + repeat key.
  await staleCheckerQueue.add(
    'daily-stale-check',
    {}, // no payload needed — worker queries DB directly
    {
      repeat: {
        pattern: '0 9 * * *', // every day at 09:00 server time
      },
      jobId: 'stale-checker-cron', // fixed ID prevents duplicate registrations
    }
  );

  console.log('🕘 [StaleChecker] Daily cron registered: "0 9 * * *" (09:00 daily)');

  // ── Start the worker ───────────────────────────────────────────────────────
  staleWorker = new Worker('stale-checker', processStaleCheck, {
    connection: createBullConnection(),
    concurrency: 1, // single concurrent execution — runs once per cron tick
    lockDuration: 5 * 60 * 1000, // 5 minutes max (scanning large job collections)
  });

  staleWorker.on('completed', (job, result) => {
    console.log(
      `✅ [StaleChecker] Cron run complete | found: ${result.staleJobsFound} | enqueued: ${result.remindersEnqueued}`
    );
  });

  staleWorker.on('failed', (job, err) => {
    console.error(`❌ [StaleChecker] Cron run failed: ${err.message}`);
  });

  staleWorker.on('error', (err) => {
    console.error('❌ [StaleChecker] Worker error:', err.message);
  });

  console.log('🔍 [StaleChecker] Stale checker worker started');
  return staleWorker;
};

export default startStaleChecker;
