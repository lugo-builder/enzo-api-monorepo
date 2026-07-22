import { EmailService } from '@app/common';
import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';

@Module({
  providers: [EmailService],
  exports: [EmailService],
  controllers: [EmailController],
})
export class EmailModule {}
