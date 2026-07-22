import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '../database.service';

@Injectable()
export class ChannelsRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.ChannelFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelFindFirstArgs>,
  ): Promise<Prisma.ChannelGetPayload<T>> {
    return this.prisma.channel.findFirst(args);
  }

  findMany<T extends Prisma.ChannelFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelFindManyArgs>,
  ): Promise<Prisma.ChannelGetPayload<T>[]> {
    return this.prisma.channel.findMany(args);
  }

  findUnique<T extends Prisma.ChannelFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelFindUniqueArgs>,
  ): Promise<Prisma.ChannelGetPayload<T>> {
    return this.prisma.channel.findUnique(args);
  }

  findFirstOrThrow<T extends Prisma.ChannelFindFirstOrThrowArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelFindFirstOrThrowArgs>,
  ): Promise<Prisma.ChannelGetPayload<T>> {
    return this.prisma.channel.findFirstOrThrow(args);
  }

  create<T extends Prisma.ChannelCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelCreateArgs>,
  ) {
    return this.prisma.channel.create(args);
  }

  createMany<T extends Prisma.ChannelCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelCreateManyArgs>,
  ) {
    return this.prisma.channel.createMany(args);
  }

  update<T extends Prisma.ChannelUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelUpdateArgs>,
  ) {
    return this.prisma.channel.update(args);
  }

  updateMany<T extends Prisma.ChannelUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelUpdateManyArgs>,
  ) {
    return this.prisma.channel.updateMany(args);
  }

  delete<T extends Prisma.ChannelDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelDeleteArgs>,
  ) {
    return this.prisma.channel.delete(args);
  }

  deleteMany<T extends Prisma.ChannelDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelDeleteManyArgs>,
  ) {
    return this.prisma.channel.deleteMany(args);
  }

  count<T extends Prisma.ChannelCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChannelCountArgs>,
  ) {
    return this.prisma.channel.count(args);
  }

  aggregate(args: Prisma.ChannelAggregateArgs) {
    return this.prisma.channel.aggregate(args);
  }

  updateChannelIsSyncErp(channelId: string, isSyncErp: boolean) {
    return this.prisma.channel.updateMany({
      where: { id: channelId },
      data: { isSyncErp },
    });
  }
}
