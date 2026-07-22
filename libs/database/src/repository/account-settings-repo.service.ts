import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '../database.service';

@Injectable()
export class AccountSettingsRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  findFirst<T extends Prisma.AccountSettingsFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsFindFirstArgs>,
  ): Promise<Prisma.AccountSettingsGetPayload<T>> {
    return this.prisma.accountSettings.findFirst(args);
  }

  findMany<T extends Prisma.AccountSettingsFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsFindManyArgs>,
  ): Promise<Prisma.AccountSettingsGetPayload<T>[]> {
    return this.prisma.accountSettings.findMany(args);
  }

  findUnique<T extends Prisma.AccountSettingsFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsFindUniqueArgs>,
  ): Promise<Prisma.AccountSettingsGetPayload<T>> {
    return this.prisma.accountSettings.findUnique(args);
  }

  findFirstOrThrow<T extends Prisma.AccountSettingsFindFirstOrThrowArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsFindFirstOrThrowArgs>,
  ): Promise<Prisma.AccountSettingsGetPayload<T>> {
    return this.prisma.accountSettings.findFirstOrThrow(args);
  }

  create<T extends Prisma.AccountSettingsCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsCreateArgs>,
  ) {
    return this.prisma.accountSettings.create(args);
  }

  createMany<T extends Prisma.AccountSettingsCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsCreateManyArgs>,
  ) {
    return this.prisma.accountSettings.createMany(args);
  }

  update<T extends Prisma.AccountSettingsUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsUpdateArgs>,
  ) {
    return this.prisma.accountSettings.update(args);
  }

  updateMany<T extends Prisma.AccountSettingsUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsUpdateManyArgs>,
  ) {
    return this.prisma.accountSettings.updateMany(args);
  }

  delete<T extends Prisma.AccountSettingsDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsDeleteArgs>,
  ) {
    return this.prisma.accountSettings.delete(args);
  }

  deleteMany<T extends Prisma.AccountSettingsDeleteManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsDeleteManyArgs>,
  ) {
    return this.prisma.accountSettings.deleteMany(args);
  }

  count<T extends Prisma.AccountSettingsCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsCountArgs>,
  ) {
    return this.prisma.accountSettings.count(args);
  }

  aggregate(args: Prisma.AccountSettingsAggregateArgs) {
    return this.prisma.accountSettings.aggregate(args);
  }

  upsert<T extends Prisma.AccountSettingsUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.AccountSettingsUpsertArgs>,
  ) {
    return this.prisma.accountSettings.upsert(args);
  }

  /**
   * Updates the isSyncErp flag for a user's account settings
   * @param userId - The user ID
   * @param isSyncErp - The sync ERP flag value
   */
  updateIsSyncErp(userId: string, isSyncErp: boolean) {
    return this.prisma.accountSettings.updateMany({
      where: { userId },
      data: { isSyncErp },
    });
  }
}
