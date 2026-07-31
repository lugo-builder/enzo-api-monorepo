import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UnitFilterDto } from './dto/unit-filter.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@Controller('units')
@ApiTags('units')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_UNITS)
  create(@Body() dto: CreateUnitDto, @CurrentUser() user) {
    return this.unitsService.create(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_UNITS)
  findAll(@Query() query: UnitFilterDto) {
    return this.unitsService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_UNITS)
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_UNITS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user,
  ) {
    return this.unitsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Can(PermissionsEnum.RESIDENT_UNITS)
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.unitsService.remove(id, user.userId);
  }

  @Get(':id/residents')
  @Can(PermissionsEnum.RESIDENT_UNITS)
  getResidents(@Param('id') id: string) {
    return this.unitsService.getResidents(id);
  }

  @Get(':id/balance')
  @Can(PermissionsEnum.RESIDENT_UNITS)
  getBalance(@Param('id') id: string, @Query('asOf') asOf?: string) {
    return this.unitsService.getBalance(id, asOf);
  }

  @Get(':id/account-summary')
  @Can(PermissionsEnum.RESIDENT_UNITS)
  getAccountSummary(@Param('id') id: string) {
    return this.unitsService.getAccountSummary(id);
  }

  @Get(':id/timeline')
  @Can(PermissionsEnum.RESIDENT_UNITS)
  getTimeline(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.unitsService.getTimeline(id, limit ? Number(limit) : undefined);
  }
}
