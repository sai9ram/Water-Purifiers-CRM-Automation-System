import { QUEUE_NAMES } from '../queues/queue.registry';

export enum AutomationJobType {
  MONTHLY_RENTAL_BILLING = 'MONTHLY_RENTAL_BILLING',
  PAYMENT_REMINDERS = 'PAYMENT_REMINDERS',
  OVERDUE_REMINDERS = 'OVERDUE_REMINDERS',
  QUARTERLY_SERVICE_SCHEDULING = 'QUARTERLY_SERVICE_SCHEDULING',
  SERVICE_REMINDERS = 'SERVICE_REMINDERS',
  NOTIFICATION_PROCESSING = 'NOTIFICATION_PROCESSING'
}

export interface JobDefinitionSpec {
  jobType: AutomationJobType;
  queueName: string;
  defaultCron: string;
  description: string;
  enabledByDefault: false; // Per Step 1 rules: do not activate real customer billing or WhatsApp jobs yet
}

export const JOB_DEFINITIONS: Record<AutomationJobType, JobDefinitionSpec> = {
  [AutomationJobType.MONTHLY_RENTAL_BILLING]: {
    jobType: AutomationJobType.MONTHLY_RENTAL_BILLING,
    queueName: QUEUE_NAMES.BILLING,
    defaultCron: '0 1 1 * *',
    description: 'Generate monthly rental invoices for active rental contracts',
    enabledByDefault: false
  },
  [AutomationJobType.PAYMENT_REMINDERS]: {
    jobType: AutomationJobType.PAYMENT_REMINDERS,
    queueName: QUEUE_NAMES.REMINDERS,
    defaultCron: '0 9 1-5 * *',
    description: 'Queue friendly rent due reminders before the 5th grace date',
    enabledByDefault: false
  },
  [AutomationJobType.OVERDUE_REMINDERS]: {
    jobType: AutomationJobType.OVERDUE_REMINDERS,
    queueName: QUEUE_NAMES.REMINDERS,
    defaultCron: '0 10 6,10,15 * *',
    description: 'Flag overdue accounts and queue overdue rent reminders after the 5th',
    enabledByDefault: false
  },
  [AutomationJobType.QUARTERLY_SERVICE_SCHEDULING]: {
    jobType: AutomationJobType.QUARTERLY_SERVICE_SCHEDULING,
    queueName: QUEUE_NAMES.SERVICES,
    defaultCron: '0 2 * * *',
    description: 'Create 90-day filter maintenance schedules for active customer assets',
    enabledByDefault: false
  },
  [AutomationJobType.SERVICE_REMINDERS]: {
    jobType: AutomationJobType.SERVICE_REMINDERS,
    queueName: QUEUE_NAMES.REMINDERS,
    defaultCron: '0 9 * * *',
    description: 'Notify customers and technicians of upcoming scheduled maintenance visits',
    enabledByDefault: false
  },
  [AutomationJobType.NOTIFICATION_PROCESSING]: {
    jobType: AutomationJobType.NOTIFICATION_PROCESSING,
    queueName: QUEUE_NAMES.NOTIFICATIONS,
    defaultCron: '*/5 * * * *',
    description: 'Dispatch queued notifications with idempotency and retry tracking',
    enabledByDefault: false
  }
};

export function buildIdempotencyKey(
  jobType: AutomationJobType,
  entityId: string,
  periodKey: string
): string {
  return `${jobType}:${entityId}:${periodKey}`;
}
