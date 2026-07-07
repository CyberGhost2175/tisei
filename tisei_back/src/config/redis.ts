import { Redis, type RedisOptions } from 'ioredis';
import { env } from './env.js';

const sharedOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
  };
}

/**
 * Shared ioredis connection factory. BullMQ requires maxRetriesPerRequest: null.
 */
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, sharedOptions);
}

/** Connection options for BullMQ queues/workers. */
export function getBullMqConnection(): RedisOptions {
  return { ...sharedOptions, ...parseRedisUrl(env.REDIS_URL) };
}

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis = globalForRedis.redis ?? createRedisConnection();

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
