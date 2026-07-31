import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PaymentApplicationService } from './payment-application.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UnitBalanceService } from './unit-balance.service';

@Module({
  imports: [AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentApplicationService, UnitBalanceService],
  exports: [PaymentApplicationService, UnitBalanceService],
})
export class PaymentsModule {}
