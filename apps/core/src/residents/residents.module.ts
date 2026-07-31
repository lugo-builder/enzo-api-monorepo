import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ResidentsController } from './residents.controller';
import { ResidentsService } from './residents.service';
import { UnitResidentsController } from './unit-residents.controller';
import { UnitResidentsService } from './unit-residents.service';

@Module({
  imports: [AuditModule],
  controllers: [ResidentsController, UnitResidentsController],
  providers: [ResidentsService, UnitResidentsService],
  exports: [ResidentsService, UnitResidentsService],
})
export class ResidentsModule {}
