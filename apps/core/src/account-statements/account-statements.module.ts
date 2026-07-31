import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { AccountStatementService } from './account-statement.service';
import { AccountStatementsController } from './account-statements.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [AccountStatementsController],
  providers: [AccountStatementService],
  exports: [AccountStatementService],
})
export class AccountStatementsModule {}
