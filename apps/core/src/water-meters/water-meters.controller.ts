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
import { CreateWaterMeterDto } from './dto/create-water-meter.dto';
import { ImportWaterMetersJsonDto } from './dto/import-water-meters-json.dto';
import { UpdateWaterMeterDto } from './dto/update-water-meter.dto';
import { WaterMeterFilterDto } from './dto/water-meter-filter.dto';
import { WaterMetersService } from './water-meters.service';

@Controller('water-meters')
@ApiTags('water-meters')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class WaterMetersController {
  constructor(private readonly waterMetersService: WaterMetersService) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_WATER_METERS)
  create(@Body() dto: CreateWaterMeterDto, @CurrentUser() user) {
    return this.waterMetersService.create(dto, user.userId);
  }

  /**
   * Alta masiva de micromedidores.
   * Puede reutilizar el JSON de lecturas (`readings` con unitNumber + meterSerial).
   */
  @Post('from-json')
  @Can(PermissionsEnum.RESIDENT_WATER_METERS)
  importFromJson(@Body() dto: ImportWaterMetersJsonDto, @CurrentUser() user) {
    return this.waterMetersService.importFromJson(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_WATER_METERS)
  findAll(@Query() query: WaterMeterFilterDto) {
    return this.waterMetersService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_METERS)
  findOne(@Param('id') id: string) {
    return this.waterMetersService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_METERS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWaterMeterDto,
    @CurrentUser() user,
  ) {
    return this.waterMetersService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_METERS)
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.waterMetersService.remove(id, user.userId);
  }
}
