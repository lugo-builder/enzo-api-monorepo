import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ResidentialComplexesController } from './residential-complexes.controller';
import { ResidentialComplexesService } from './residential-complexes.service';

@Module({
  imports: [AuditModule],
  controllers: [ResidentialComplexesController],
  providers: [ResidentialComplexesService],
  exports: [ResidentialComplexesService],
})
export class ResidentialComplexesModule {}
