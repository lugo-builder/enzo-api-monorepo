import { Injectable } from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database.service';

@Injectable()
export class CatalogItemRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.CatalogItemFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemFindFirstArgs>,
  ): Promise<Prisma.CatalogItemGetPayload<T>> {
    return this.prisma.catalogItem.findFirst(args);
  }

  findMany<T extends Prisma.CatalogItemFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemFindManyArgs>,
  ): Promise<Prisma.CatalogItemGetPayload<T>[]> {
    return this.prisma.catalogItem.findMany(args);
  }

  findUnique<T extends Prisma.CatalogItemFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemFindUniqueArgs>,
  ): Promise<Prisma.CatalogItemGetPayload<T>> {
    return this.prisma.catalogItem.findUnique(args);
  }

  findFirstOrThrow<T extends Prisma.CatalogItemFindFirstOrThrowArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemFindFirstOrThrowArgs>,
  ): Promise<Prisma.CatalogItemGetPayload<T>> {
    return this.prisma.catalogItem.findFirstOrThrow(args);
  }

  create<T extends Prisma.CatalogItemCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemCreateArgs>,
  ) {
    return this.prisma.catalogItem.create(args);
  }

  createMany<T extends Prisma.CatalogItemCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemCreateManyArgs>,
  ) {
    return this.prisma.catalogItem.createMany(args);
  }

  update<T extends Prisma.CatalogItemUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemUpdateArgs>,
  ) {
    return this.prisma.catalogItem.update(args);
  }

  updateMany<T extends Prisma.CatalogItemUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemUpdateManyArgs>,
  ) {
    return this.prisma.catalogItem.updateMany(args);
  }

  delete<T extends Prisma.CatalogItemDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemDeleteArgs>,
  ) {
    return this.prisma.catalogItem.delete(args);
  }

  deleteMany<T extends Prisma.CatalogItemDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemDeleteManyArgs>,
  ) {
    return this.prisma.catalogItem.deleteMany(args);
  }

  count<T extends Prisma.CatalogItemCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.CatalogItemCountArgs>,
  ) {
    return this.prisma.catalogItem.count(args);
  }

  aggregate(args: Prisma.CatalogItemAggregateArgs) {
    return this.prisma.catalogItem.aggregate(args);
  }
}
