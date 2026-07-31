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
import { CreateWaterPeriodDto } from './dto/create-water-period.dto';
import { ApplyCeaProrationDto } from './dto/apply-cea-proration.dto';
import { ImportWaterReadingsJsonDto } from './dto/import-water-readings-json.dto';
import { UpdateWaterPeriodDto } from './dto/update-water-period.dto';
import { WaterPeriodFilterDto } from './dto/water-period-filter.dto';
import { WaterPeriodsService } from './water-periods.service';

@Controller('water-periods')
@ApiTags('water-readings')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class WaterPeriodsController {
  constructor(private readonly waterPeriodsService: WaterPeriodsService) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  create(@Body() dto: CreateWaterPeriodDto, @CurrentUser() user) {
    return this.waterPeriodsService.create(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  findAll(@Query() query: WaterPeriodFilterDto) {
    return this.waterPeriodsService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  findOne(@Param('id') id: string) {
    return this.waterPeriodsService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWaterPeriodDto,
    @CurrentUser() user,
  ) {
    return this.waterPeriodsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.waterPeriodsService.remove(id, user.userId);
  }

  @Get(':id/readings')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  getReadings(
    @Param('id') id: string,
    @Query('inheritFromPrevious') inheritFromPrevious: string | undefined,
    @CurrentUser() user,
  ) {
    return this.waterPeriodsService.getReadings(id, {
      inheritFromPrevious:
        inheritFromPrevious === '1' ||
        inheritFromPrevious === 'true' ||
        inheritFromPrevious === 'yes',
      userId: user?.userId,
    });
  }

  @Get(':id/report')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  getReport(@Param('id') id: string) {
    return this.waterPeriodsService.getReport(id);
  }

  @Post(':id/import-readings-json')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  importReadingsJson(
    @Param('id') id: string,
    @Body() dto: ImportWaterReadingsJsonDto,
    @CurrentUser() user,
  ) {
    return this.waterPeriodsService.importReadingsFromJson(id, dto, user.userId);
  }

  @Post(':id/generate-reading-records')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  generateReadingRecords(@Param('id') id: string, @CurrentUser() user) {
    return this.waterPeriodsService.generateReadingRecords(id, user.userId);
  }

  @Post(':id/apply-cea-proration')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  applyCeaProration(
    @Param('id') id: string,
    @Body() dto: ApplyCeaProrationDto,
    @CurrentUser() user,
  ) {
    return this.waterPeriodsService.applyCeaProration(id, dto, user.userId);
  }

  @Post(':id/calculate')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  calculate(@Param('id') id: string, @CurrentUser() user) {
    return this.waterPeriodsService.calculate(id, user.userId);
  }

  @Post(':id/close')
  @Can(PermissionsEnum.RESIDENT_WATER_READINGS)
  close(@Param('id') id: string, @CurrentUser() user) {
    return this.waterPeriodsService.close(id, user.userId);
  }

  @Post(':id/reopen')
  @Can(PermissionsEnum.RESIDENT_PERIOD_REOPEN)
  reopen(@Param('id') id: string, @CurrentUser() user) {
    return this.waterPeriodsService.reopen(id, user.userId);
  }
}
