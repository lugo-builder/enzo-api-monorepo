import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '@app/database';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: DatabaseService) {}

  async log(params: {
    userId?: string;
    entityType: string;
    entityId: string;
    action: string;
    previousData?: Prisma.InputJsonValue;
    newData?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }) {
    const sanitizedPrevious = this.sanitize(params.previousData);
    const sanitizedNew = this.sanitize(params.newData);
    const sanitizedMeta = this.sanitize(params.metadata);

    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        previousData: sanitizedPrevious ?? undefined,
        newData: sanitizedNew ?? undefined,
        metadata: sanitizedMeta ?? undefined,
      },
    });
  }

  private sanitize(data?: Prisma.InputJsonValue): Prisma.InputJsonValue | null {
    if (data === undefined || data === null) return null;
    const json = JSON.stringify(data);
    const redacted = json
      .replace(/"(password|token|secret|authorization)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"')
      .replace(/"(clabe|accountNumber|cardNumber)"\s*:\s*"[^"]*"/gi, '"$1":"[MASKED]"');
    return JSON.parse(redacted);
  }
}
