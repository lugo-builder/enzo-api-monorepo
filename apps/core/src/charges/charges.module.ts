import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ChargeTypesController } from './charge-types.controller';
import { ChargeTypesService } from './charge-types.service';
import { ChargesController } from './charges.controller';
import { ChargesService } from './charges.service';

@Module({
  imports: [AuditModule],
  controllers: [ChargesController, ChargeTypesController],
  providers: [ChargesService, ChargeTypesService],
  exports: [ChargesService, ChargeTypesService],
})
export class ChargesModule {}
