import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import Resume from '../models/Resume.js';

// ─── BullMQ Redis Connection ──────────────────────────────────────────────────
// Worker needs its own dedicated ioredis connection (blocking subscriber)
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// ─── Text Extraction Helpers ──────────────────────────────────────────────────

/**
 * Extract text from a PDF file using pdf-parse.
 * @param {string} filePath — absolute path to the PDF
 * @returns {Promise<string>} — extracted text
 */
const extractFromPDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text?.trim() || '';
};

/**
 * Route text extraction to the correct parser based on MIME type.
 * DOCX extraction via mammoth can be added in Phase 5.
 */
const extractText = async (filePath, mimeType) => {
  if (mimeType === 'application/pdf') {
    return extractFromPDF(filePath);
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    // DOCX extraction — Phase 5 will integrate mammoth
    // Returning empty string for now; ATS scoring will handle gracefully
    console.warn(`⚠️  [ResumeParser] DOCX text extraction not yet implemented. File: ${filePath}`);
    return '';
  }

  throw new Error(`Unsupported file type for text extraction: ${mimeType}`);
};

// ─── Worker Process Function ──────────────────────────────────────────────────
const processResumeJob = async (job) => {
  const { resumeId, filePath, mimeType } = job.data;

  console.log(
    `🔄 [ResumeParser] Processing job ${job.id} | resumeId: ${resumeId} | attempt: ${job.attemptsMade + 1}`
  );

  // ── Mark as processing ────────────────────────────────────────────────────
  await Resume.findByIdAndUpdate(resumeId, {
    $set: { parseStatus: 'processing', parseError: null },
  });

  // ── Validate file exists ──────────────────────────────────────────────────
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found on disk: ${filePath}`);
  }

  // ── Extract text ──────────────────────────────────────────────────────────
  const extractedText = await extractText(filePath, mimeType);

  if (!extractedText) {
    console.warn(
      `⚠️  [ResumeParser] No text extracted from file: ${path.basename(filePath)}`
    );
  }

  // ── Update Resume document ────────────────────────────────────────────────
  await Resume.findByIdAndUpdate(resumeId, {
    $set: {
      extractedText,
      parseStatus: 'done',
      parsedAt: new Date(),
      parseError: null,
    },
  });

  console.log(
    `✅ [ResumeParser] Job ${job.id} complete | resumeId: ${resumeId} | chars extracted: ${extractedText.length}`
  );

  return { resumeId, charCount: extractedText.length };
};

// ─── Worker Instance ──────────────────────────────────────────────────────────
let worker;

export const startResumeParserWorker = () => {
  worker = new Worker('resume-parsing', processResumeJob, {
    connection,
    concurrency: 3,
    // Retry config is set on the queue defaultJobOptions (resumeQueue.js)
    // Worker-level: how long to lock job (prevent other workers from picking up)
    lockDuration: 60_000, // 60 seconds per job max
  });

  // ── Worker lifecycle events ───────────────────────────────────────────────
  worker.on('completed', (job, result) => {
    console.log(
      `✅ [ResumeParser] Job ${job.id} completed | ${result.charCount} chars`
    );
  });

  worker.on('failed', async (job, err) => {
    console.error(
      `❌ [ResumeParser] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`
    );

    // On final failure (all retries exhausted), mark resume as failed in DB
    if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      try {
        await Resume.findByIdAndUpdate(job.data.resumeId, {
          $set: {
            parseStatus: 'failed',
            parseError: err.message.slice(0, 500),
          },
        });
        console.log(`📝 [ResumeParser] Marked resume ${job.data.resumeId} as failed in DB`);
      } catch (dbErr) {
        console.error(`❌ [ResumeParser] Failed to update DB for resume ${job.data.resumeId}:`, dbErr.message);
      }
    }
  });

  worker.on('error', (err) => {
    console.error('❌ [ResumeParser] Worker error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`⚠️  [ResumeParser] Job ${jobId} stalled — will be retried`);
  });

  console.log('🔧 [ResumeParser] Worker started with concurrency: 3');
  return worker;
};

export default startResumeParserWorker;
