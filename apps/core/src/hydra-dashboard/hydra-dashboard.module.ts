import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { HydraDashboardController } from './hydra-dashboard.controller';
import { HydraDashboardService } from './hydra-dashboard.service';

@Module({
  imports: [PaymentsModule],
  controllers: [HydraDashboardController],
  providers: [HydraDashboardService],
  exports: [HydraDashboardService],
})
export class HydraDashboardModule {}
