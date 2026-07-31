import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { DashboardPeriodQueryDto, DashboardQueryDto } from './dto/dashboard-query.dto';
import { HydraDashboardService } from './hydra-dashboard.service';

@Controller('hydra-dashboard')
@ApiTags('hydra-dashboard')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class HydraDashboardController {
  constructor(private readonly hydraDashboardService: HydraDashboardService) {}

  @Get('summary')
  @Can(PermissionsEnum.RESIDENT_REPORTS)
  summary(@Query() query: DashboardQueryDto) {
    return this.hydraDashboardService.summary(query.residentialComplexId);
  }

  @Get('collection')
  @Can(PermissionsEnum.RESIDENT_REPORTS)
  collection(@Query() query: DashboardPeriodQueryDto) {
    return this.hydraDashboardService.collection(query.residentialComplexId, query.year, query.month);
  }

  @Get('delinquency')
  @Can(PermissionsEnum.RESIDENT_REPORTS)
  delinquency(@Query() query: DashboardQueryDto) {
    return this.hydraDashboardService.delinquency(query.residentialComplexId);
  }

  @Get('water-consumption')
  @Can(PermissionsEnum.RESIDENT_REPORTS)
  waterConsumption(@Query() query: DashboardPeriodQueryDto) {
    return this.hydraDashboardService.waterConsumption(
      query.residentialComplexId,
      query.year,
      query.month,
    );
  }
}
