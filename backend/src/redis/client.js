import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => Math.min(times * 200, 2000),
  lazyConnect: true,
});

redis.on('error', (err) => console.error('[Redis] Error:', err.message));

// Separate subscriber client (can't be used for commands after subscribe)
export const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => Math.min(times * 200, 2000),
  lazyConnect: true,
});
