import Redis from 'ioredis';

let redisClient = null;

export const connectRedis = async () => {
  try {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('❌ Redis: max retries exceeded');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('connect', () => console.log('✅ Redis connected'));
    redisClient.on('ready', () => console.log('✅ Redis ready'));
    redisClient.on('error', (err) => console.error('❌ Redis error:', err.message));
    redisClient.on('close', () => console.warn('⚠️  Redis connection closed'));
    redisClient.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));

    await redisClient.connect();
    await redisClient.ping();
  } catch (err) {
    console.error(`❌ Redis connection failed: ${err.message}`);
    process.exit(1);
  }
};

/**
 * Returns the active Redis client instance.
 * @returns {Redis} ioredis client
 */
export const getRedis = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};
