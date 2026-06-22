/**
 * worker.js — Standalone worker entry point.
 *
 * Run independently of the API server:
 *   node worker.js
 *   npm run worker
 *
 * This process ONLY runs BullMQ workers — it does NOT start an HTTP server.
 * Connects to MongoDB (for DB updates) and Redis (via BullMQ internal connection).
 */
import 'dotenv/config';
import { connectDB } from './config/db.js';
import { startResumeParserWorker } from './workers/resumeParserWorker.js';
import { startAtsScoringWorker } from './workers/atsScoringWorker.js';
import { startReminderWorker } from './workers/reminderWorker.js';
import { startStaleChecker } from './workers/staleChecker.js';

const startWorkers = async () => {
  try {
    console.log('\n🔧 HireTrail Worker Process starting...\n');

    // MongoDB connection required for Resume document updates
    await connectDB();

    // ── Start all workers ─────────────────────────────────────────────────────
    startResumeParserWorker();    // Phase 3 — PDF/DOCX text extraction
    startAtsScoringWorker();      // Phase 4 — TF-IDF + cosine similarity ATS scoring
    startReminderWorker();        // Phase 5 — Follow-up email reminders
    await startStaleChecker();    // Phase 5 — Daily 9 AM stale-job cron (async — registers cron)

    console.log('\n✅ All workers running. Waiting for jobs...\n');

    // ── Graceful shutdown ─────────────────────────────────────────────────────
    const gracefulShutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received — shutting down workers gracefully...`);
      // Workers will finish current jobs before shutting down
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      console.error('❌ [Worker] Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('❌ [Worker] Uncaught Exception:', err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Failed to start workers:', err.message);
    process.exit(1);
  }
};

startWorkers();
