import { ConnectionOptions } from 'bullmq';
import { env } from '../config/env';

export function getRedisConnectionOptions(): ConnectionOptions {
  const parsed = new URL(env.REDIS_URL);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true
  };
}
