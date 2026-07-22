import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { config } from '@app/common/consts/base.config';
import { DatabaseService } from '@app/database';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    const permissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      return false;
    }
    if (user.rol.name === config.defaultAdmin) {
      return true;
    }
    if (roles && roles.length) {
      const hasRole = roles.includes(user.rol.name);
      if (!hasRole) {
        return false;
      }
    }
    if (!permissions) {
      return true;
    }
    const userRole = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        role: {
          select: {
            RolPermission: {
              select: {
                permission: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userRole) {
      return false;
    }

    const hasPermission = userRole.role.RolPermission?.some((permission) =>
      permissions.includes(permission.permission.name),
    );
    return hasPermission;
  }
}
