import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// ─── BullMQ Redis Connection ──────────────────────────────────────────────────
// BullMQ requires a dedicated ioredis connection with:
//   - maxRetriesPerRequest: null  (BullMQ uses blocking commands)
//   - enableReadyCheck: false     (avoids startup race conditions)
const createBullConnection = () =>
  new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

// ─── Resume Parsing Queue ─────────────────────────────────────────────────────
export const resumeQueue = new Queue('resume-parsing', {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s → 4s → 8s
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // keep completed jobs for 24h
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // keep failed jobs for 7 days for debugging
    },
  },
});

resumeQueue.on('error', (err) => {
  console.error('❌ [ResumeQueue] Queue error:', err.message);
});

export default resumeQueue;
