import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '../database.service';

@Injectable()
export class AuditLogRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.AuditLogFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindFirstArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T> | null> {
    return this.prisma.auditLog.findFirst(args);
  }

  findMany<T extends Prisma.AuditLogFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindManyArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T>[]> {
    return this.prisma.auditLog.findMany(args);
  }

  findUnique<T extends Prisma.AuditLogFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogFindUniqueArgs>,
  ): Promise<Prisma.AuditLogGetPayload<T> | null> {
    return this.prisma.auditLog.findUnique(args);
  }

  create<T extends Prisma.AuditLogCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogCreateArgs>,
  ) {
    return this.prisma.auditLog.create(args);
  }

  createMany<T extends Prisma.AuditLogCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogCreateManyArgs>,
  ) {
    return this.prisma.auditLog.createMany(args);
  }

  update<T extends Prisma.AuditLogUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogUpdateArgs>,
  ) {
    return this.prisma.auditLog.update(args);
  }

  updateMany<T extends Prisma.AuditLogUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogUpdateManyArgs>,
  ) {
    return this.prisma.auditLog.updateMany(args);
  }

  delete<T extends Prisma.AuditLogDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogDeleteArgs>,
  ) {
    return this.prisma.auditLog.delete(args);
  }

  deleteMany<T extends Prisma.AuditLogDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogDeleteManyArgs>,
  ) {
    return this.prisma.auditLog.deleteMany(args);
  }

  count<T extends Prisma.AuditLogCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogCountArgs>,
  ) {
    return this.prisma.auditLog.count(args);
  }

  aggregate(args: Prisma.AuditLogAggregateArgs) {
    return this.prisma.auditLog.aggregate(args);
  }
}
