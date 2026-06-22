import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// ─── BullMQ Redis Connection ──────────────────────────────────────────────────
// Dedicated ioredis instance — BullMQ requires maxRetriesPerRequest: null
const createBullConnection = () =>
  new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

// ─── ATS Scoring Queue ────────────────────────────────────────────────────────
export const atsQueue = new Queue('ats-scoring', {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s → 2s → 4s (CPU-bound, shorter backoff than file I/O)
    },
    removeOnComplete: {
      age: 24 * 60 * 60,  // keep for 24h
      count: 200,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // keep failed jobs 7 days for debugging
    },
  },
});

atsQueue.on('error', (err) => {
  console.error('❌ [AtsQueue] Queue error:', err.message);
});

export default atsQueue;
