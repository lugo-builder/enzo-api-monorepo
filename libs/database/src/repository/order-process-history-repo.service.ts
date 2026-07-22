import { Injectable } from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database.service';

@Injectable()
export class OrderProcessHistoryRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.OrderProcessHistoryFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderProcessHistoryFindFirstArgs>,
  ): Promise<Prisma.OrderProcessHistoryGetPayload<T>> {
    return this.prisma.orderProcessHistory.findFirst(args);
  }

  findMany<T extends Prisma.OrderProcessHistoryFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderProcessHistoryFindManyArgs>,
  ): Promise<Prisma.OrderProcessHistoryGetPayload<T>[]> {
    return this.prisma.orderProcessHistory.findMany(args);
  }

  create<T extends Prisma.OrderProcessHistoryCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderProcessHistoryCreateArgs>,
  ) {
    return this.prisma.orderProcessHistory.create(args);
  }

  createMany<T extends Prisma.OrderProcessHistoryCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderProcessHistoryCreateManyArgs>,
  ) {
    return this.prisma.orderProcessHistory.createMany(args);
  }

  update<T extends Prisma.OrderProcessHistoryUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderProcessHistoryUpdateArgs>,
  ): Promise<Prisma.OrderProcessHistoryGetPayload<T>> {
    return this.prisma.orderProcessHistory.update(args);
  }

  delete<T extends Prisma.OrderProcessHistoryDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrderProcessHistoryDeleteArgs>,
  ): Promise<Prisma.OrderProcessHistoryGetPayload<T>> {
    return this.prisma.orderProcessHistory.delete(args);
  }
}
