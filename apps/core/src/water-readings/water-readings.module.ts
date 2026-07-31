import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { WaterTariffsModule } from '../water-tariffs/water-tariffs.module';
import { WaterPeriodsController } from './water-periods.controller';
import { WaterPeriodsService } from './water-periods.service';
import { WaterReadingsController } from './water-readings.controller';
import { WaterReadingsService } from './water-readings.service';

@Module({
  imports: [AuditModule, WaterTariffsModule],
  controllers: [WaterPeriodsController, WaterReadingsController],
  providers: [WaterPeriodsService, WaterReadingsService],
  exports: [WaterPeriodsService, WaterReadingsService],
})
export class WaterReadingsModule {}
