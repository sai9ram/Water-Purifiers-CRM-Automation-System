import { DefaultJobOptions, Queue } from 'bullmq';
import { getRedisConnectionOptions } from './redis.config';

export const QUEUE_NAMES = {
  BILLING: 'phw-billing-queue',
  REMINDERS: 'phw-reminders-queue',
  SERVICES: 'phw-services-queue',
  NOTIFICATIONS: 'phw-notifications-queue'
} as const;

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000
  },
  removeOnComplete: {
    age: 86400,
    count: 500
  },
  removeOnFail: {
    age: 7 * 86400,
    count: 1000
  }
};

export function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS
  });
}
