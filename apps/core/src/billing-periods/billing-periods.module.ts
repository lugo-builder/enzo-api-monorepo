import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BillingGenerationService } from './billing-generation.service';
import { BillingPeriodsController } from './billing-periods.controller';
import { BillingPeriodsService } from './billing-periods.service';

@Module({
  imports: [AuditModule],
  controllers: [BillingPeriodsController],
  providers: [BillingPeriodsService, BillingGenerationService],
  exports: [BillingPeriodsService, BillingGenerationService],
})
export class BillingPeriodsModule {}
