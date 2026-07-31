import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { CloseUnitResidentDto } from './dto/close-unit-resident.dto';
import { CreateUnitResidentDto } from './dto/create-unit-resident.dto';
import { UpdateUnitResidentDto } from './dto/update-unit-resident.dto';
import { UnitResidentsService } from './unit-residents.service';

@Controller('units/:unitId/residents')
@ApiTags('residents')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class UnitResidentsController {
  constructor(private readonly unitResidentsService: UnitResidentsService) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_RESIDENTS)
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateUnitResidentDto,
    @CurrentUser() user,
  ) {
    return this.unitResidentsService.create(unitId, dto, user.userId);
  }

  @Patch(':unitResidentId')
  @Can(PermissionsEnum.RESIDENT_RESIDENTS)
  update(
    @Param('unitId') unitId: string,
    @Param('unitResidentId') unitResidentId: string,
    @Body() dto: UpdateUnitResidentDto,
    @CurrentUser() user,
  ) {
    return this.unitResidentsService.update(unitId, unitResidentId, dto, user.userId);
  }

  @Delete(':unitResidentId')
  @Can(PermissionsEnum.RESIDENT_RESIDENTS)
  close(
    @Param('unitId') unitId: string,
    @Param('unitResidentId') unitResidentId: string,
    @Body() dto: CloseUnitResidentDto,
    @CurrentUser() user,
  ) {
    return this.unitResidentsService.close(unitId, unitResidentId, dto, user.userId);
  }
}
