import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ImportValidationService } from './import-validation.service';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [AuditModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImportValidationService],
  exports: [ImportsService, ImportValidationService],
})
export class ImportsModule {}
