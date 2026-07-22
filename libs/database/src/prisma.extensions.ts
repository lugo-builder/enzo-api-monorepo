import { Prisma } from '@prisma/client';

export const softDeleteExtension = Prisma.defineExtension({
  name: 'softDelete',
  model: {
    $allModels: {
      async delete(this: any, args: Prisma.Args<any, 'delete'>) {
        const context = Prisma.getExtensionContext(this);
        return context.update({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
      async deleteMany(this: any, args: Prisma.Args<any, 'deleteMany'>) {
        const context = Prisma.getExtensionContext(this);
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
        args.where = { ...args.where, deletedAt: null };
        return this.findUnique(args);
      },
      async findFirst(this: any, args: Prisma.Args<any, 'findFirst'>) {
        args.where = { ...args.where, deletedAt: null };
        return this.findFirst(args);
      },
      async findMany(this: any, args: Prisma.Args<any, 'findMany'>) {
        args.where = { ...args.where, deletedAt: null };
        return this.findMany(args);
      },
    },
  },
});
