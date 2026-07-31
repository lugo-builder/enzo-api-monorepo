import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { ReplaceWaterMeterDto } from './dto/replace-water-meter.dto';
import { WaterMetersService } from './water-meters.service';

@Controller('units/:unitId/water-meters')
@ApiTags('water-meters')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class UnitWaterMetersController {
  constructor(private readonly waterMetersService: WaterMetersService) {}

  @Post('replace')
  @Can(PermissionsEnum.RESIDENT_WATER_METERS)
  replace(
    @Param('unitId') unitId: string,
    @Body() dto: ReplaceWaterMeterDto,
    @CurrentUser() user,
  ) {
    return this.waterMetersService.replace(unitId, dto, user.userId);
  }

  @Get('history')
  @Can(PermissionsEnum.RESIDENT_WATER_METERS)
  history(@Param('unitId') unitId: string) {
    return this.waterMetersService.getHistory(unitId);
  }
}
