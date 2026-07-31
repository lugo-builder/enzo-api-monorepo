import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { WaterBillingCalculatorService } from './water-billing-calculator.service';
import { WaterTariffsController } from './water-tariffs.controller';
import { WaterTariffsService } from './water-tariffs.service';

@Module({
  imports: [AuditModule],
  controllers: [WaterTariffsController],
  providers: [WaterTariffsService, WaterBillingCalculatorService],
  exports: [WaterBillingCalculatorService, WaterTariffsService],
})
export class WaterTariffsModule {}
