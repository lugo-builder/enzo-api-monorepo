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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { CreateLookupWaterTariffDto } from './dto/create-lookup-water-tariff.dto';
import { CreateWaterTariffDto } from './dto/create-water-tariff.dto';
import { SimulateWaterTariffDto } from './dto/simulate-water-tariff.dto';
import { UpdateWaterTariffDto } from './dto/update-water-tariff.dto';
import { WaterTariffFilterDto } from './dto/water-tariff-filter.dto';
import { WaterTariffsService } from './water-tariffs.service';

@Controller('water-tariffs')
@ApiTags('water-tariffs')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class WaterTariffsController {
  constructor(private readonly waterTariffsService: WaterTariffsService) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_WATER_TARIFFS)
  create(@Body() dto: CreateWaterTariffDto, @CurrentUser() user) {
    return this.waterTariffsService.create(dto, user.userId);
  }

  /**
   * Carga el tarifario completo tipo PDF CEA:
   * { rateTariffDate: "05-2026", measures: [{ m3, price }, ...] }
   * Upsert por (residentialComplexId, rateTariffDate): no duplica vigencia.
   */
  @Post('from-lookup-json')
  @Can(PermissionsEnum.RESIDENT_WATER_TARIFFS)
  createFromLookupJson(
    @Body() dto: CreateLookupWaterTariffDto,
    @CurrentUser() user,
  ) {
    return this.waterTariffsService.createFromLookupJson(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_WATER_TARIFFS)
  findAll(@Query() query: WaterTariffFilterDto) {
    return this.waterTariffsService.findAll(query);
  }

  @Get('latest')
  @Can(PermissionsEnum.RESIDENT_WATER_TARIFFS)
  async findLatest(
    @Query('residentialComplexId') residentialComplexId: string,
  ) {
    if (!residentialComplexId) {
      throw new BadRequestException('residentialComplexId is required');
    }
    const latest =
      await this.waterTariffsService.findLatestForBilling(residentialComplexId);
    if (!latest) {
      throw new NotFoundException(
        'No active water tariff with tiers found for this complex',
      );
    }
    return latest;
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_TARIFFS)
  findOne(@Param('id') id: string) {
    return this.waterTariffsService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_TARIFFS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWaterTariffDto,
    @CurrentUser() user,
  ) {
    return this.waterTariffsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Can(PermissionsEnum.RESIDENT_WATER_TARIFFS)
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.waterTariffsService.remove(id, user.userId);
  }

  @Post(':id/simulate')
  @Can(PermissionsEnum.RESIDENT_WATER_TARIFFS)
  simulate(@Param('id') id: string, @Body() dto: SimulateWaterTariffDto) {
    return this.waterTariffsService.simulate(id, dto);
  }
}
