import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import Resume from '../models/Resume.js';
import { analyzeResume } from '../services/atsAnalyzer.js';

// ─── BullMQ Redis Connection ──────────────────────────────────────────────────
// Each worker requires its own dedicated ioredis blocking connection.
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// ─── Worker Process Function ──────────────────────────────────────────────────

/**
 * Process a single ATS scoring job.
 * Job payload: { jobId: string, resumeId: string }
 *
 * Steps:
 *  1. Fetch job.jobDescription from MongoDB
 *  2. Fetch resume.extractedText from MongoDB
 *  3. Run analyzeResume() — TF-IDF + cosine similarity
 *  4. Persist atsScore, atsKeywordsMatched, atsKeywordGaps back to Job doc
 */
const processAtsJob = async (job) => {
  const { jobId, resumeId } = job.data;

  console.log(
    `🤖 [AtsWorker] Processing job ${job.id} | jobId: ${jobId} | resumeId: ${resumeId} | attempt: ${job.attemptsMade + 1}`
  );

  // ── Validate IDs ──────────────────────────────────────────────────────────
  if (
    !mongoose.Types.ObjectId.isValid(jobId) ||
    !mongoose.Types.ObjectId.isValid(resumeId)
  ) {
    throw new Error(`Invalid ObjectId — jobId: ${jobId} | resumeId: ${resumeId}`);
  }

  // ── Fetch Job document ────────────────────────────────────────────────────
  const jobDoc = await Job.findById(jobId).select('jobDescription userId deletedAt');
  if (!jobDoc) {
    throw new Error(`Job not found in DB: ${jobId}`);
  }
  if (jobDoc.deletedAt) {
    throw new Error(`Job ${jobId} has been soft-deleted — skipping ATS analysis`);
  }
  if (!jobDoc.jobDescription || jobDoc.jobDescription.trim().length < 20) {
    throw new Error(`Job ${jobId} has no/insufficient jobDescription for ATS analysis`);
  }

  // ── Fetch Resume document ─────────────────────────────────────────────────
  const resumeDoc = await Resume.findById(resumeId).select('extractedText parseStatus userId');
  if (!resumeDoc) {
    throw new Error(`Resume not found in DB: ${resumeId}`);
  }
  if (resumeDoc.parseStatus !== 'done' || !resumeDoc.extractedText) {
    throw new Error(
      `Resume ${resumeId} is not ready for ATS (parseStatus: ${resumeDoc.parseStatus})`
    );
  }

  // ── Run ATS Analysis ──────────────────────────────────────────────────────
  const { atsScore, matchedKeywords, gapKeywords, similarity } = analyzeResume(
    resumeDoc.extractedText,
    jobDoc.jobDescription
  );

  // ── Persist results to Job document ──────────────────────────────────────
  await Job.findByIdAndUpdate(
    jobId,
    {
      $set: {
        atsScore,
        atsKeywordsMatched: matchedKeywords,
        atsKeywordGaps: gapKeywords,
      },
    },
    { runValidators: true }
  );

  console.log(
    `✅ [AtsWorker] Job ${job.id} complete | ATS Score: ${atsScore}/100 | ` +
    `Matched: ${matchedKeywords.length} | Gaps: ${gapKeywords.length} | ` +
    `Cosine similarity: ${similarity}`
  );

  return { jobId, resumeId, atsScore, similarity };
};

// ─── Worker Instance ──────────────────────────────────────────────────────────
let worker;

export const startAtsScoringWorker = () => {
  worker = new Worker('ats-scoring', processAtsJob, {
    connection,
    concurrency: 2,          // CPU-bound NLP — keep concurrency conservative
    lockDuration: 120_000,   // 2 minutes max per job (NLP on large docs can be slow)
  });

  // ── Lifecycle events ──────────────────────────────────────────────────────
  worker.on('completed', (job, result) => {
    console.log(
      `✅ [AtsWorker] Job ${job.id} completed | Score: ${result.atsScore}/100`
    );
  });

  worker.on('failed', async (job, err) => {
    console.error(
      `❌ [AtsWorker] Job ${job?.id} failed ` +
      `(attempt ${job?.attemptsMade}/${job?.opts?.attempts ?? 3}): ${err.message}`
    );

    // On final failure, reset ATS score to null so frontend shows "failed" state
    if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      try {
        await Job.findByIdAndUpdate(job.data.jobId, {
          $set: { atsScore: null, atsKeywordsMatched: [], atsKeywordGaps: [] },
        });
        console.log(`📝 [AtsWorker] Cleared ATS fields for job ${job.data.jobId} after final failure`);
      } catch (dbErr) {
        console.error(`❌ [AtsWorker] DB cleanup error: ${dbErr.message}`);
      }
    }
  });

  worker.on('error', (err) => {
    console.error('❌ [AtsWorker] Worker error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`⚠️  [AtsWorker] Job ${jobId} stalled — will be retried`);
  });

  console.log('🤖 [AtsWorker] ATS Scoring Worker started with concurrency: 2');
  return worker;
};

export default startAtsScoringWorker;
