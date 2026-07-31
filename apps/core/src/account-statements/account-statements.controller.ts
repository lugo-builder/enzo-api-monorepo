import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AsyncParser } from '@json2csv/node';
import type { Response } from 'express';

import { Can, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { AccountStatementService } from './account-statement.service';
import { AccountStatementQueryDto } from './dto/account-statement-query.dto';

@Controller()
@ApiTags('account-statements')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class AccountStatementsController {
  constructor(
    private readonly accountStatementService: AccountStatementService,
  ) {}

  @Get('units/:unitId/account-statements')
  @Can(PermissionsEnum.RESIDENT_ACCOUNT_STATEMENTS)
  listUnitStatements(
    @Param('unitId') unitId: string,
    @Query() query: AccountStatementQueryDto,
  ) {
    return this.accountStatementService.getUnitStatement(
      unitId,
      query.billingPeriodId,
    );
  }

  @Get('units/:unitId/account-statements/:year/:month')
  @Can(PermissionsEnum.RESIDENT_ACCOUNT_STATEMENTS)
  getUnitStatementByPeriod(
    @Param('unitId') unitId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.accountStatementService.getUnitStatement(
      unitId,
      undefined,
      Number(year),
      Number(month),
    );
  }

  @Get('billing-periods/:periodId/account-statements')
  @Can(PermissionsEnum.RESIDENT_ACCOUNT_STATEMENTS)
  getPeriodStatements(@Param('periodId') periodId: string) {
    return this.accountStatementService.getPeriodStatements(periodId);
  }

  @Get('billing-periods/:periodId/account-statements/export')
  @Can(PermissionsEnum.RESIDENT_ACCOUNT_STATEMENTS)
  async exportPeriodStatements(
    @Param('periodId') periodId: string,
    @Res() res: Response,
  ) {
    const statements =
      await this.accountStatementService.getPeriodStatements(periodId);
    const rows = statements.flatMap((s) =>
      this.accountStatementService.toCsvRows(s),
    );
    const csv = await new AsyncParser({}, {}, {}).parse(rows).promise();
    res.header('Content-Type', 'text/csv');
    res.attachment(`account-statements-period-${periodId}.csv`);
    res.send(csv);
  }
}
