import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankTransactionsService } from './bank-transactions.service';
import { BankTransactionFilterDto } from './dto/bank-transaction-filter.dto';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';
import { IgnoreTransactionDto } from './dto/ignore-transaction.dto';
import { MatchTransactionDto } from './dto/match-transaction.dto';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto';

@Controller('bank-transactions')
@ApiTags('bank-transactions')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class BankTransactionsController {
  constructor(
    private readonly bankTransactionsService: BankTransactionsService,
    private readonly bankReconciliationService: BankReconciliationService,
  ) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  create(@Body() dto: CreateBankTransactionDto, @CurrentUser() user) {
    return this.bankTransactionsService.create(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  findAll(@Query() query: BankTransactionFilterDto) {
    return this.bankTransactionsService.findAll(query);
  }

  @Get('reconciliation-summary')
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  reconciliationSummary(@Query('residentialComplexId') residentialComplexId: string) {
    return this.bankReconciliationService.reconciliationSummary(residentialComplexId);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  findOne(@Param('id') id: string) {
    return this.bankTransactionsService.findOne(id);
  }

  @Post('import')
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importFile(
    @Query('residentialComplexId') residentialComplexId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user,
  ) {
    return this.bankTransactionsService.importFromFile(residentialComplexId, file.buffer, user.userId);
  }

  @Post(':id/suggest-match')
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  suggestMatch(@Param('id') id: string) {
    return this.bankReconciliationService.suggestMatch(id);
  }

  @Post(':id/match')
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  match(
    @Param('id') id: string,
    @Body() dto: MatchTransactionDto,
    @CurrentUser() user,
  ) {
    return this.bankReconciliationService.match(id, dto.unitId, user.userId);
  }

  @Post(':id/ignore')
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  ignore(
    @Param('id') id: string,
    @Body() dto: IgnoreTransactionDto,
    @CurrentUser() user,
  ) {
    return this.bankReconciliationService.ignore(id, dto.reason, user.userId);
  }

  @Post(':id/reverse')
  @Can(PermissionsEnum.RESIDENT_BANK_RECONCILIATION)
  reverse(
    @Param('id') id: string,
    @Body() dto: ReverseTransactionDto,
    @CurrentUser() user,
  ) {
    return this.bankReconciliationService.reverse(id, dto.reason, user.userId);
  }
}
