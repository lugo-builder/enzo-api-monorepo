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
import { BillingGenerationService } from './billing-generation.service';
import { BillingPeriodsService } from './billing-periods.service';
import { BillingPeriodFilterDto } from './dto/billing-period-filter.dto';
import { CreateBillingPeriodDto } from './dto/create-billing-period.dto';
import { GenerateBillingPeriodDto } from './dto/generate-billing-period.dto';
import { UpdateBillingPeriodDto } from './dto/update-billing-period.dto';

@Controller('billing-periods')
@ApiTags('billing-periods')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class BillingPeriodsController {
  constructor(
    private readonly billingPeriodsService: BillingPeriodsService,
    private readonly billingGenerationService: BillingGenerationService,
  ) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_BILLING_PERIODS)
  create(@Body() dto: CreateBillingPeriodDto, @CurrentUser() user) {
    return this.billingPeriodsService.create(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_BILLING_PERIODS)
  findAll(@Query() query: BillingPeriodFilterDto) {
    return this.billingPeriodsService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_BILLING_PERIODS)
  findOne(@Param('id') id: string) {
    return this.billingPeriodsService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_BILLING_PERIODS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBillingPeriodDto,
    @CurrentUser() user,
  ) {
    return this.billingPeriodsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Can(PermissionsEnum.RESIDENT_BILLING_PERIODS)
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.billingPeriodsService.remove(id, user.userId);
  }

  @Post(':id/generate')
  @Can(PermissionsEnum.RESIDENT_BILLING_PERIODS)
  generate(
    @Param('id') id: string,
    @Body() dto: GenerateBillingPeriodDto,
    @CurrentUser() user,
  ) {
    return this.billingGenerationService.generate(id, dto, user.userId);
  }

  @Post(':id/close')
  @Can(PermissionsEnum.RESIDENT_BILLING_PERIODS)
  close(@Param('id') id: string, @CurrentUser() user) {
    return this.billingPeriodsService.close(id, user.userId);
  }

  @Post(':id/reopen')
  @Can(PermissionsEnum.RESIDENT_PERIOD_REOPEN)
  reopen(@Param('id') id: string, @CurrentUser() user) {
    return this.billingPeriodsService.reopen(id, user.userId);
  }

  @Get(':id/summary')
  @Can(PermissionsEnum.RESIDENT_BILLING_PERIODS)
  summary(@Param('id') id: string) {
    return this.billingPeriodsService.summary(id);
  }
}
