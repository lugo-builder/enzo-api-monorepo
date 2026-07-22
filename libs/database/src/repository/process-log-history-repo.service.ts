import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '../database.service';

@Injectable()
export class ProcessLogHistoryRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.ProcessLogHistoryFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryFindFirstArgs>,
  ): Promise<Prisma.ProcessLogHistoryGetPayload<T> | null> {
    return this.prisma.processLogHistory.findFirst(args);
  }

  findMany<T extends Prisma.ProcessLogHistoryFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryFindManyArgs>,
  ): Promise<Prisma.ProcessLogHistoryGetPayload<T>[]> {
    return this.prisma.processLogHistory.findMany(args);
  }

  findUnique<T extends Prisma.ProcessLogHistoryFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryFindUniqueArgs>,
  ): Promise<Prisma.ProcessLogHistoryGetPayload<T> | null> {
    return this.prisma.processLogHistory.findUnique(args);
  }

  create<T extends Prisma.ProcessLogHistoryCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryCreateArgs>,
  ) {
    return this.prisma.processLogHistory.create(args);
  }

  createMany<T extends Prisma.ProcessLogHistoryCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryCreateManyArgs>,
  ) {
    return this.prisma.processLogHistory.createMany(args);
  }

  update<T extends Prisma.ProcessLogHistoryUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryUpdateArgs>,
  ) {
    return this.prisma.processLogHistory.update(args);
  }

  updateMany<T extends Prisma.ProcessLogHistoryUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryUpdateManyArgs>,
  ) {
    return this.prisma.processLogHistory.updateMany(args);
  }

  delete<T extends Prisma.ProcessLogHistoryDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryDeleteArgs>,
  ) {
    return this.prisma.processLogHistory.delete(args);
  }

  deleteMany<T extends Prisma.ProcessLogHistoryDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryDeleteManyArgs>,
  ) {
    return this.prisma.processLogHistory.deleteMany(args);
  }

  count<T extends Prisma.ProcessLogHistoryCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.ProcessLogHistoryCountArgs>,
  ) {
    return this.prisma.processLogHistory.count(args);
  }

  aggregate(args: Prisma.ProcessLogHistoryAggregateArgs) {
    return this.prisma.processLogHistory.aggregate(args);
  }
}
