import { Injectable } from '@nestjs/common';

import { DatabaseService } from '@app/database';

@Injectable()
export class UserRepoService {
  constructor(private readonly prisma: DatabaseService) {}

  getUserById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        deactivatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
