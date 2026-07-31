import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankTransactionsController } from './bank-transactions.controller';
import { BankTransactionsService } from './bank-transactions.service';

@Module({
  imports: [AuditModule],
  controllers: [BankTransactionsController],
  providers: [BankTransactionsService, BankReconciliationService],
  exports: [BankTransactionsService, BankReconciliationService],
})
export class BankTransactionsModule {}
