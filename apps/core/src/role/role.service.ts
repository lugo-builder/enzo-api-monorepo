import { Injectable } from '@nestjs/common';

import { CustomException, ErrorCodes } from '@app/common';
import { DatabaseService } from '@app/database';

import { FindByRoleDto } from './dto/find-byRol-request.dto';
import { DeletePermissionToRoleDto } from './dto/delete-permission-request.dto';
import { AssignPermissionToRoleDto } from './dto/assign-permission-request.dto';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: DatabaseService) {}

  async assignPermissionToRole(
    assignPermissionToRoleDto: AssignPermissionToRoleDto,
    userId: string,
  ) {
    try {
      const role = await this.prisma.rol.findFirst({
        where: { id: assignPermissionToRoleDto.roleId, deletedAt: null },
      });
      if (!role) {
        throw new CustomException(ErrorCodes.ROL_NOT_FOUND);
      }
      const permission = await this.prisma.permission.findFirst({
        where: { id: assignPermissionToRoleDto.permissionId, deletedAt: null },
      });
      if (!permission) {
        throw new CustomException(ErrorCodes.PERMISSION_NOT_FOUND);
      }
      const permissionToRole = await this.prisma.rolPermission.findFirst({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (permissionToRole) {
        throw new CustomException(ErrorCodes.PERMISSION_ALREADY_ASSIGNED);
      }
      await this.prisma.rolPermission.create({
        data: {
          roleId: role.id,
          permissionId: assignPermissionToRoleDto.permissionId,
          createdBy: userId,
        },
        select: {
          permissionId: true,
          roleId: true,
          permission: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      return true;
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async deletePermissionToRole(
    deletePermissionToRoleDto: DeletePermissionToRoleDto,
  ) {
    try {
      const role = await this.prisma.rol.findFirst({
        where: { id: deletePermissionToRoleDto.roleId, deletedAt: null },
      });
      if (!role) {
        throw new CustomException(ErrorCodes.ROL_NOT_FOUND);
      }
      const permission = await this.prisma.permission.findFirst({
        where: { id: deletePermissionToRoleDto.permissionId, deletedAt: null },
      });
      if (!permission) {
        throw new CustomException(ErrorCodes.PERMISSION_NOT_FOUND);
      }
      const permissionToRole = await this.prisma.rolPermission.findFirst({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!permissionToRole) {
        throw new CustomException(ErrorCodes.PERMISSION_NOT_FOUND);
      }
      await this.prisma.rolPermission.delete({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
      });
      return true;
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async findPermissionToRole(findPermissionToRoleDto: FindByRoleDto) {
    try {
      const role = await this.prisma.rol.findFirst({
        where: { id: findPermissionToRoleDto.roleId },
      });
      if (!role) {
        throw new CustomException(ErrorCodes.ROL_NOT_FOUND);
      }
      const listPermission = await this.prisma.rolPermission.findMany({
        where: { roleId: role.id },
        select: {
          permissionId: true,
          roleId: true,
          permission: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      return listPermission;
    } catch (error) {
      if (error instanceof CustomException) {
        throw error;
      }
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async findRole(findRoleDto: FindByRoleDto) {
    try {
      const role = await this.prisma.rol.findUnique({
        where: { id: findRoleDto.roleId, deletedAt: null },
      });
      if (!role) {
        throw new CustomException(ErrorCodes.ROL_NOT_FOUND);
      }
      return role;
    } catch (error) {
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async findAll() {
    try {
      const roles = await this.prisma.rol.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          RolPermission: {
            select: {
              permission: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return roles.map((role) => ({
        id: role.id,
        name: role.name,
        permissions: role.RolPermission.map((rp) => ({
          id: rp.permission.id,
          name: rp.permission.name,
        })),
      }));
    } catch (error) {
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }

  async allPermissions() {
    try {
      return this.prisma.permission.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
        },
      });
    } catch (error) {
      throw new CustomException(ErrorCodes.UNHANDLED_EXCEPTION);
    }
  }
}
