import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database.service';

@Injectable()
export class ChannelOrderItemRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.ChannelOrderItemFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemFindFirstArgs>,
  ): Promise<Prisma.ChannelOrderItemGetPayload<T>> {
    return this.prisma.channelOrderItem.findFirst(args);
  }

  findMany<T extends Prisma.ChannelOrderItemFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemFindManyArgs>,
  ): Promise<Prisma.ChannelOrderItemGetPayload<T>[]> {
    return this.prisma.channelOrderItem.findMany(args);
  }

  findUnique<T extends Prisma.ChannelOrderItemFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemFindUniqueArgs>,
  ): Promise<Prisma.ChannelOrderItemGetPayload<T>> {
    return this.prisma.channelOrderItem.findUnique(args);
  }

  findFirstOrThrow<T extends Prisma.ChannelOrderItemFindFirstOrThrowArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemFindFirstOrThrowArgs>,
  ): Promise<Prisma.ChannelOrderItemGetPayload<T>> {
    return this.prisma.channelOrderItem.findFirstOrThrow(args);
  }

  create<T extends Prisma.ChannelOrderItemCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemCreateArgs>,
  ) {
    return this.prisma.channelOrderItem.create(args);
  }

  createMany<T extends Prisma.ChannelOrderItemCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemCreateManyArgs>,
  ) {
    return this.prisma.channelOrderItem.createMany(args);
  }

  update<T extends Prisma.ChannelOrderItemUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemUpdateArgs>,
  ) {
    return this.prisma.channelOrderItem.update(args);
  }

  updateMany<T extends Prisma.ChannelOrderItemUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemUpdateManyArgs>,
  ) {
    return this.prisma.channelOrderItem.updateMany(args);
  }

  delete<T extends Prisma.ChannelOrderItemDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemDeleteArgs>,
  ) {
    return this.prisma.channelOrderItem.delete(args);
  }

  deleteMany<T extends Prisma.ChannelOrderItemDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemDeleteManyArgs>,
  ) {
    return this.prisma.channelOrderItem.deleteMany(args);
  }

  count<T extends Prisma.ChannelOrderItemCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelOrderItemCountArgs>,
  ) {
    return this.prisma.channelOrderItem.count(args);
  }

  aggregate(args: Prisma.ChannelOrderItemAggregateArgs) {
    return this.prisma.channelOrderItem.aggregate(args);
  }
}
