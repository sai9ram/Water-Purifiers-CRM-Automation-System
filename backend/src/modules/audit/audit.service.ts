import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export interface CreateAuditLogInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditRepository {
  async create(input: CreateAuditLogInput) {
    return prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        beforeState: (input.beforeState as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        afterState: (input.afterState as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null
      }
    });
  }
}

export class AuditService {
  private readonly repo = new AuditRepository();

  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.repo.create(input);
    } catch {
      // Never fail primary request if audit write encounters transient error
    }
  }
}

export const auditService = new AuditService();
