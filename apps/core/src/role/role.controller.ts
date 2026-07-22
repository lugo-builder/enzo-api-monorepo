import { Controller, Post, Body, Get, UseGuards, Query } from '@nestjs/common';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RoleService } from './role.service';
import { AssignPermissionToRoleDto } from './dto/assign-permission-request.dto';
import { DeletePermissionToRoleDto } from './dto/delete-permission-request.dto';
import { FindByRoleDto } from './dto/find-byRol-request.dto';
import { PermissionsEnum } from './types/permissions.enums';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('role')
@ApiTags('role')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
export class RoleController {
  constructor(private readonly rolService: RoleService) {}

  @Post('permission')
  @Can(PermissionsEnum.ROLES)
  async assignPermissionToRole(
    @Body() assignPermissionToRoleDto: AssignPermissionToRoleDto,
    @CurrentUser() user,
  ) {
    return this.rolService.assignPermissionToRole(
      assignPermissionToRoleDto,
      user.userId,
    );
  }

  @Post('permission/delete')
  @Can(PermissionsEnum.ROLES)
  async deletePermissionToRole(
    @Body() deletePermissionToRoleDto: DeletePermissionToRoleDto,
  ) {
    return this.rolService.deletePermissionToRole(deletePermissionToRoleDto);
  }

  @Get('permission/findByRole')
  async findPermissionToRole(@Query() findPermissionToRoleDto: FindByRoleDto) {
    return this.rolService.findPermissionToRole(findPermissionToRoleDto);
  }

  @Get('findAll')
  async findAll() {
    return this.rolService.findAll();
  }

  @Get('allPermissions')
  async allPermissions() {
    return this.rolService.allPermissions();
  }
}
