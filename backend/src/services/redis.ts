import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      console.warn(`[Redis] Failed to connect after ${times} retries. Continuing in fallback mode.`);
      return null; // Stop retrying
    }
    return Math.min(times * 100, 2000);
  }
});

redis.on('error', (err) => {
  console.error('[Redis] Connection Error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully.');
});

export default redis;
