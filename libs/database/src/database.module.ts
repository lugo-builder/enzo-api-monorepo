import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/** Only DatabaseService (Prisma) is provided; repos for non-schema models are omitted */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
