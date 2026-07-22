import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '../database.service';

@Injectable()
export class ProcessLogRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.ProcessLogFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogFindFirstArgs>,
  ): Promise<Prisma.ProcessLogGetPayload<T> | null> {
    return this.prisma.processLog.findFirst(args);
  }

  findMany<T extends Prisma.ProcessLogFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogFindManyArgs>,
  ): Promise<Prisma.ProcessLogGetPayload<T>[]> {
    return this.prisma.processLog.findMany(args);
  }

  findUnique<T extends Prisma.ProcessLogFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogFindUniqueArgs>,
  ): Promise<Prisma.ProcessLogGetPayload<T> | null> {
    return this.prisma.processLog.findUnique(args);
  }

  create<T extends Prisma.ProcessLogCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogCreateArgs>,
  ) {
    return this.prisma.processLog.create(args);
  }

  createMany<T extends Prisma.ProcessLogCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogCreateManyArgs>,
  ) {
    return this.prisma.processLog.createMany(args);
  }

  update<T extends Prisma.ProcessLogUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogUpdateArgs>,
  ) {
    return this.prisma.processLog.update(args);
  }

  updateMany<T extends Prisma.ProcessLogUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogUpdateManyArgs>,
  ) {
    return this.prisma.processLog.updateMany(args);
  }

  delete<T extends Prisma.ProcessLogDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogDeleteArgs>,
  ) {
    return this.prisma.processLog.delete(args);
  }

  deleteMany<T extends Prisma.ProcessLogDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogDeleteManyArgs>,
  ) {
    return this.prisma.processLog.deleteMany(args);
  }

  count<T extends Prisma.ProcessLogCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogCountArgs>,
  ) {
    return this.prisma.processLog.count(args);
  }

  aggregate(args: Prisma.ProcessLogAggregateArgs) {
    return this.prisma.processLog.aggregate(args);
  }
}
