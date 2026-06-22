/**
 * services/reminderService.js
 *
 * scheduleFollowUpReminder — enqueue a delayed BullMQ reminder job.
 * Called automatically on job creation (default 7-day delay)
 * and manually via POST /api/jobs/:id/remind.
 */

import { reminderQueue } from '../queues/reminderQueue.js';

/**
 * Schedule a follow-up reminder email for a job application.
 *
 * @param {string|ObjectId} jobId      — MongoDB Job _id
 * @param {string|ObjectId} userId     — MongoDB User _id
 * @param {number}          delayDays  — Days to delay before sending (default: 7)
 * @returns {Promise<Job>}             — BullMQ job instance
 */
export const scheduleFollowUpReminder = async (jobId, userId, delayDays = 7) => {
  const delayMs = Math.max(0, delayDays) * 24 * 60 * 60 * 1000;

  const bullJob = await reminderQueue.add(
    'follow-up-reminder',
    {
      jobId:  jobId.toString(),
      userId: userId.toString(),
      scheduledAt: new Date().toISOString(),
    },
    {
      delay: delayMs,
      // Unique key prevents duplicate reminders for the same job.
      // Including a timestamp allows manual re-triggers to always enqueue.
      jobId: `reminder:${jobId}:${Date.now()}`,
    }
  );

  const delayLabel =
    delayMs === 0 ? 'immediately' : `in ${delayDays} day${delayDays === 1 ? '' : 's'}`;

  console.log(
    `⏰ [Reminder] Scheduled follow-up for job ${jobId} | sends ${delayLabel} | bullJobId: ${bullJob.id}`
  );

  return bullJob;
};

export default scheduleFollowUpReminder;
