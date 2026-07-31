import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PaymentsModule } from '../payments/payments.module';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [AuditModule, PaymentsModule],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
