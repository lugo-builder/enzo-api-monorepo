import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';
import { DatabaseService } from '@app/database';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { FilterDto } from './dto/filter.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RolUpdateDto } from './dto/rol-update.dto';
import { StatusUpdateDto } from './dto/status-update.dto';
import { UsersService } from './users.service';

@Controller('users')
@ApiTags('users')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: DatabaseService,
  ) {}

  @Get()
  async findAll(@Query() filterDto: FilterDto) {
    return this.usersService.findAll(filterDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/updateRole')
  @Can(PermissionsEnum.USERS)
  updateRol(
    @Param('id') id: string,
    @Body() rolUpdateDto: RolUpdateDto,
    @CurrentUser() user,
  ) {
    return this.usersService.updateRole(id, rolUpdateDto, user.userId);
  }

  @Patch(':id/updateStatusBack')
  updateStatusBack(@Param('id') id: string, @CurrentUser() user) {
    return this.usersService.updateStatusBack(id, user.userId);
  }

  @Post()
  create(@Body() registerRequestDto: RegisterRequestDto, @CurrentUser() user) {
    return this.usersService.create(registerRequestDto, user.userId);
  }

  @Patch(':id/updateStatus')
  @Can(PermissionsEnum.USERS)
  updateStatus(
    @Param('id') id: string,
    @Body() statusUpdateDto: StatusUpdateDto,
    @CurrentUser() user,
  ) {
    return this.usersService.updateStatus(id, statusUpdateDto, user.userId);
  }

  @Patch(':id/updateAuthorization')
  updateAuthorization(@Param('id') id: string, @CurrentUser() user) {
    return this.usersService.updateAuthorization(id, user.userId);
  }
}
