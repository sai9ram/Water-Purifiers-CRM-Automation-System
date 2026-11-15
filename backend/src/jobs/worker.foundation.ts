import { Job } from 'bullmq';
import { prisma } from '../database/prisma';
import { logger } from '../config/logger';
import { AutomationJobType } from './job.definitions';

export interface IdempotentJobPayload {
  automationJobId: string;
  jobType: AutomationJobType;
  idempotencyKey: string;
  data: Record<string, unknown>;
}

/**
 * Worker execution wrapper providing idempotency checks, attempt tracking,
 * and structured failure logging in PostgreSQL (`automation_logs`).
 * Note: Workers are intentionally not started automatically in Step 1.
 */
export async function executeIdempotentJob(
  job: Job<IdempotentJobPayload>,
  handler: (payload: IdempotentJobPayload) => Promise<Record<string, unknown>>
): Promise<void> {
  const { automationJobId, idempotencyKey, jobType } = job.data;

  const existing = await prisma.automationLog.findUnique({
    where: { idempotencyKey }
  });

  if (existing && existing.status === 'COMPLETED') {
    logger.info({ idempotencyKey, jobType }, 'Skipping already-completed idempotent job');
    return;
  }

  const logEntry = await prisma.automationLog.upsert({
    where: { idempotencyKey },
    update: {
      attemptNumber: job.attemptsMade + 1,
      status: 'RUNNING',
      errorMessage: null
    },
    create: {
      automationJobId,
      idempotencyKey,
      attemptNumber: job.attemptsMade + 1,
      status: 'RUNNING'
    }
  });

  try {
    const details = await handler(job.data);
    await prisma.automationLog.update({
      where: { id: logEntry.id },
      data: {
        status: 'COMPLETED',
        details: details as object,
        finishedAt: new Date()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown worker error';
    await prisma.automationLog.update({
      where: { id: logEntry.id },
      data: {
        status: 'FAILED',
        errorMessage: message,
        finishedAt: new Date()
      }
    });
    logger.error({ err: error, idempotencyKey, jobType }, 'Background job failed');
    throw error;
  }
}
