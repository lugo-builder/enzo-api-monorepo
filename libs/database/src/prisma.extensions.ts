import { Prisma } from '@prisma/client';

/**
 * Models that actually declare a `deletedAt` column. Several Hydra models
 * (WaterTariff, UnitCharge, Payment, BankTransaction, etc.) intentionally do
 * not support soft-delete, so the global extensions below must only touch
 * `deletedAt` for models that own that column — otherwise Prisma throws an
 * "Unknown argument `deletedAt`" validation error at runtime.
 */
const modelsWithDeletedAt = new Set<string>(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'deletedAt'))
    .map((model) => model.name),
);

export const softDeleteExtension = Prisma.defineExtension({
  name: 'softDelete',
  model: {
    $allModels: {
      async delete(this: any, args: Prisma.Args<any, 'delete'>) {
        const context = Prisma.getExtensionContext(this);
        if (!modelsWithDeletedAt.has((context as any).$name)) {
          throw new Error(
            `Model ${(context as any).$name} does not have a deletedAt column; ` +
              'use updateMany with a status/cancellation field instead of delete().',
          );
        }
        return context.update({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
      async deleteMany(this: any, args: Prisma.Args<any, 'deleteMany'>) {
        const context = Prisma.getExtensionContext(this);
        if (!modelsWithDeletedAt.has((context as any).$name)) {
          throw new Error(
            `Model ${(context as any).$name} does not have a deletedAt column; ` +
              'use updateMany with a status/cancellation field instead of deleteMany().',
          );
        }
        return context.updateMany({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
    },
  },
});

export const filterSoftDeletedExtension = Prisma.defineExtension({
  name: 'filterSoftDeleted',
  model: {
    $allModels: {
      async findUnique(this: any, args: Prisma.Args<any, 'findUnique'>) {
        const context = Prisma.getExtensionContext(this);
        if (modelsWithDeletedAt.has((context as any).$name)) {
          args.where = { ...args.where, deletedAt: null };
        }
        return this.findUnique(args);
      },
      async findFirst(this: any, args: Prisma.Args<any, 'findFirst'>) {
        const context = Prisma.getExtensionContext(this);
        if (modelsWithDeletedAt.has((context as any).$name)) {
          args.where = { ...args.where, deletedAt: null };
        }
        return this.findFirst(args);
      },
      async findMany(this: any, args: Prisma.Args<any, 'findMany'>) {
        const context = Prisma.getExtensionContext(this);
        if (modelsWithDeletedAt.has((context as any).$name)) {
          args.where = { ...args.where, deletedAt: null };
        }
        return this.findMany(args);
      },
    },
  },
});
