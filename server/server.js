import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to databases
    await connectDB();
    await connectRedis();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 HireTrail API running on port ${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });

    // ── Graceful Shutdown ───────────────────────────────────────────────────
    const gracefulShutdown = (signal) => {
      console.log(`\n⚠️  ${signal} received — shutting down gracefully...`);
      server.close(async () => {
        console.log('🔒 HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
