import { CommonModule } from '@app/common/common.module';
import { Global, Module } from '@nestjs/common';
import { ErpOrdersService } from './erp-orders.service';
import { ErpShipmentService } from './erp-shipment.service';
import { GuideDownloadService } from './guide-download.service';

@Global()
@Module({
  imports: [CommonModule],
  providers: [ErpOrdersService, ErpShipmentService, GuideDownloadService],
  exports: [ErpOrdersService, ErpShipmentService, GuideDownloadService],
})
export class ErpOrdersModule {}
