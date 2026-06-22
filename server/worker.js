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

const startWorkers = async () => {
  try {
    console.log('\n🔧 HireTrail Worker Process starting...\n');

    // MongoDB connection required for Resume document updates
    await connectDB();

    // ── Start all workers ─────────────────────────────────────────────────────
    startResumeParserWorker();

    // Future workers (uncomment as phases complete):
    // startAtsScoreWorker();    // Phase 5
    // startReminderWorker();    // Phase 6

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
