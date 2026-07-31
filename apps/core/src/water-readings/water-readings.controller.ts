import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { UpdateWaterReadingDto } from './dto/update-water-reading.dto';
import { WaterReadingFilterDto } from './dto/water-reading-filter.dto';
import { WaterReadingsService } from './water-readings.service';

@Controller('water-readings')
@ApiTags('water-readings')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class WaterReadingsController {
  constructor(private readonly waterReadingsService: WaterReadingsService) {}

  @Get()
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  findAll(@Query() query: WaterReadingFilterDto) {
    return this.waterReadingsService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  findOne(@Param('id') id: string) {
    return this.waterReadingsService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWaterReadingDto,
    @CurrentUser() user,
  ) {
    return this.waterReadingsService.update(id, dto, user.userId);
  }
}
