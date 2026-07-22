import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '../database.service';

@Injectable()
export class ChannelOrderRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.ChannelOrderFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderFindFirstArgs>,
  ): Promise<Prisma.ChannelOrderGetPayload<T>> {
    return this.prisma.channelOrder.findFirst(args);
  }

  findMany<T extends Prisma.ChannelOrderFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderFindManyArgs>,
  ): Promise<Prisma.ChannelOrderGetPayload<T>[]> {
    return this.prisma.channelOrder.findMany(args);
  }

  findUnique<T extends Prisma.ChannelOrderFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderFindUniqueArgs>,
  ): Promise<Prisma.ChannelOrderGetPayload<T>> {
    return this.prisma.channelOrder.findUnique(args);
  }

  findFirstOrThrow<T extends Prisma.ChannelOrderFindFirstOrThrowArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderFindFirstOrThrowArgs>,
  ): Promise<Prisma.ChannelOrderGetPayload<T>> {
    return this.prisma.channelOrder.findFirstOrThrow(args);
  }

  create<T extends Prisma.ChannelOrderCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderCreateArgs>,
  ) {
    return this.prisma.channelOrder.create(args);
  }

  createMany<T extends Prisma.ChannelOrderCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderCreateManyArgs>,
  ) {
    return this.prisma.channelOrder.createMany(args);
  }

  update<T extends Prisma.ChannelOrderUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderUpdateArgs>,
  ) {
    return this.prisma.channelOrder.update(args);
  }

  updateMany<T extends Prisma.ChannelOrderUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderUpdateManyArgs>,
  ) {
    return this.prisma.channelOrder.updateMany(args);
  }

  delete<T extends Prisma.ChannelOrderDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderDeleteArgs>,
  ) {
    return this.prisma.channelOrder.delete(args);
  }

  deleteMany<T extends Prisma.ChannelOrderDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderDeleteManyArgs>,
  ) {
    return this.prisma.channelOrder.deleteMany(args);
  }

  count<T extends Prisma.ChannelOrderCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderCountArgs>,
  ) {
    return this.prisma.channelOrder.count(args);
  }

  aggregate(args: Prisma.ChannelOrderAggregateArgs) {
    return this.prisma.channelOrder.aggregate(args);
  }
}
