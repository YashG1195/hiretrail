import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// ─── BullMQ Redis Connection ──────────────────────────────────────────────────
const createBullConnection = () =>
  new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

// ─── Reminders Queue ──────────────────────────────────────────────────────────
export const reminderQueue = new Queue('reminders', {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s → 10s → 20s
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60, // keep 7 days
      count: 500,
    },
    removeOnFail: {
      age: 30 * 24 * 60 * 60, // keep failed for 30 days
    },
  },
});

reminderQueue.on('error', (err) => {
  console.error('❌ [ReminderQueue] Queue error:', err.message);
});

export default reminderQueue;
