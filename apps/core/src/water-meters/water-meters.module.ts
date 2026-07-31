import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { UnitWaterMetersController } from './unit-water-meters.controller';
import { WaterMetersController } from './water-meters.controller';
import { WaterMetersService } from './water-meters.service';

@Module({
  imports: [AuditModule],
  controllers: [WaterMetersController, UnitWaterMetersController],
  providers: [WaterMetersService],
  exports: [WaterMetersService],
})
export class WaterMetersModule {}
