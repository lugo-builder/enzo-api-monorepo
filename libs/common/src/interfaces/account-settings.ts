import { Prisma } from '@prisma/client';

export type AccountSettings = Prisma.AccountSettingsGetPayload<{
  include: {
    logisticProviderCredentials: true;
  };
}>;
