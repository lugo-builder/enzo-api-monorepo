import { config, getGuideS3Key, OrderData, S3Service } from '@app/common';
import { DeliveryStatusKey } from '@app/common/enums/orders.enum';
import { YujuService } from '@app/common/services/yuju.service';
import { ZplService } from '@app/common/services/zpl.service';
import { ChannelOrderRepoService, DatabaseService } from '@app/database';
import { LogService } from '@app/log';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, ShipmentOrigin } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class ErpShipmentService {
  private readonly apiRestErpUrl: string;

  constructor(
    private readonly logService: LogService,
    private readonly configService: ConfigService,
    private readonly channelOrderRepoService: ChannelOrderRepoService,
    private readonly prisma: DatabaseService,
    private readonly s3Service: S3Service,
    private readonly zplService: ZplService,
    private readonly yujuService: YujuService,
  ) {
    this.apiRestErpUrl = this.configService.get<string>(
      'API_REST_NEXT_CLOUD_URL',
    );
  }

  /**
   * When the guide comes from Next, here it is obtained and saved in the s3
   * @param shipmentsErpDetail - Shipment details grouped by delivery status with delivery information
   * @param tokenErp - Authentication token
   */
  async downloadShipmentErp(
    shipmentsErpDetail: Record<DeliveryStatusKey, Array<OrderData>>,
    tokenErp: string,
  ): Promise<void> {
    try {
      // Extract all order numbers from shipmentsErpDetail
      const orderNumbers = Object.values(shipmentsErpDetail)
        .flat()
        .map((shipment) => shipment.orderNumberErp);

      this.logService.info(
        'Initials shipment data download',
        ErpShipmentService.name,
        {
          shipmentsErpDetail,
          orderNumbers,
          tokenErp,
        },
      );

      // Process each shipment group
      for (const [status, shipments] of Object.entries(shipmentsErpDetail)) {
        for (const shipment of shipments) {
          try {
            // Only process shipments with origin NEXT
            if (shipment.shipmentOrigin !== ShipmentOrigin.NEXT) {
              this.logService.info(
                'Skipping shipment - not from NEXT origin',
                ErpShipmentService.name,
                {
                  orderNumberErp: shipment.orderNumberErp,
                  shipmentOrigin: shipment.shipmentOrigin,
                },
              );
              continue;
            }

            // Skip if the order status is not IN_TRANSIT or DELIVERED
            if (
              shipment.statusOrder !== OrderStatus.IN_TRANSIT &&
              shipment.statusOrder !== OrderStatus.DELIVERED
            ) {
              this.logService.info(
                'Skipping shipment - not in IN_TRANSIT or DELIVERED status',
                ErpShipmentService.name,
                {
                  orderNumberErp: shipment.orderNumberErp,
                  statusOrder: shipment.statusOrder,
                },
              );
              continue;
            }

            const deliveryData = shipment.delivery;
            const { id_entrega } = deliveryData;
            const urlErp = `${this.apiRestErpUrl}/rest/next/third-party/deliveries/folio/${id_entrega}`;

            this.logService.info(
              'Processing shipment data',
              ErpShipmentService.name,
              {
                orderNumberErp: shipment.orderNumberErp,
                deliveryData,
                urlErp,
              },
            );

            const responseDelivery = await axios.get(urlErp, {
              headers: { Authorization: tokenErp },
            });

            const shipmentInfo = responseDelivery.data;
            // Validate shipmentData before destructuring
            if (
              !shipmentInfo.data ||
              !Array.isArray(shipmentInfo.data) ||
              shipmentInfo.data.length === 0
            ) {
              const errorMsg = 'No shipment data available for delivery';
              this.logService.warn(errorMsg, ErpShipmentService.name, {
                orderNumberErp: shipment.orderNumberErp,
                id_entrega,
                shipmentInfo,
              });

              // Update guideTrackingDetail with error
              await this.updateGuideTrackingDetailWithError(
                shipment.orderNumberErp,
                errorMsg,
              );
              continue;
            }

            const { courier, tracking_number, file_type, file } =
              shipmentInfo.data[0];

            // Get existing order to merge shipmentDetail and guideTrackingDetail
            const existingOrder = await this.channelOrderRepoService.findFirst({
              where: { orderNumberErp: shipment.orderNumberErp },
              select: {
                shipmentDetail: true,
                guideTrackingDetail: true,
              },
            });

            const existingShipmentDetail =
              (existingOrder?.shipmentDetail as Record<string, any>) || {};
            const existingGuideTrackingDetail =
              (existingOrder?.guideTrackingDetail as Record<string, any>) || {};

            // Merge existing shipmentDetail with new data
            let updatedShipmentDetail = {
              ...existingShipmentDetail,
              courier,
              tracking_number: tracking_number,
            };

            // Download and save guide to S3
            let pdfBuffer: Buffer;

            if (file_type === 'ZPL') {
              pdfBuffer = await this.zplService.convertZplToPdf(file);
            } else {
              // Convertir base64 string a Buffer cuando no es ZPL
              pdfBuffer = Buffer.from(file, 'base64');
            }

            const s3Key = getGuideS3Key(
              tracking_number,
              shipment.ecommerceType,
            );

            const s3Url = await this.s3Service.uploadFile(
              config.BUCKET_INVENTORY_FILES,
              s3Key,
              pdfBuffer,
            );
            updatedShipmentDetail['guide_s3_url'] = s3Url;
            updatedShipmentDetail['guide_s3_key'] = s3Key;

            this.logService.info(
              'Getting shipment data',
              ErpShipmentService.name,
              {
                shipmentDetail: updatedShipmentDetail,
              },
            );

            const downloadDate = new Date().toISOString();
            updatedShipmentDetail['guide_fetched_at'] = downloadDate;

            // Update guideTrackingDetail with download date (success)
            const updatedGuideTrackingDetail = {
              ...existingGuideTrackingDetail,
              downloadDate,
              uploadDateToERP: downloadDate,
              errorMessage: null, // Clear any previous error
              lastDownloadAttemptDate: null,
              lastUploadAttemptDate: null,
            };

            await this.channelOrderRepoService.update({
              where: { orderNumberErp: shipment.orderNumberErp },
              data: {
                shipmentDetail: updatedShipmentDetail,
                guideTrackingDetail: updatedGuideTrackingDetail,
                shipmentGuideS3Key: s3Key,
              },
            });

            this.logService.info(
              'Guide downloaded and saved successfully',
              ErpShipmentService.name,
              {
                orderNumberErp: shipment.orderNumberErp,
                s3Key,
              },
            );
          } catch (error) {
            // Handle any error during guide download
            const errorMessage =
              error?.message || 'Unknown error downloading guide';

            this.logService.error(
              'Error downloading guide for shipment',
              ErpShipmentService.name,
              {
                orderNumberErp: shipment.orderNumberErp,
                error: errorMessage,
                stack: error?.stack,
              },
            );

            // Update guideTrackingDetail with error information
            await this.updateGuideTrackingDetailWithError(
              shipment.orderNumberErp,
              errorMessage,
            );
          }

          // Note: Yuju status updates are handled separately in the calling service
        }
      }
    } catch (error) {
      this.logService.error(
        'Error getting shipment data',
        ErpShipmentService.name,
        error,
      );
    }
  }

  /**
   * Update guideTrackingDetail with error information when guide download fails
   * @param orderNumberErp - Order number in ERP
   * @param errorMessage - Error message
   */
  private async updateGuideTrackingDetailWithError(
    orderNumberErp: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const existingOrder = await this.channelOrderRepoService.findFirst({
        where: { orderNumberErp },
        select: {
          id: true,
          guideTrackingDetail: true,
        },
      });

      if (!existingOrder) {
        this.logService.warn(
          'Order not found when updating guideTrackingDetail with error',
          ErpShipmentService.name,
          { orderNumberErp },
        );
        return;
      }

      const existingGuideTrackingDetail =
        (existingOrder.guideTrackingDetail as Record<string, any>) || {};

      const updatedGuideTrackingDetail = {
        ...existingGuideTrackingDetail,
        lastDownloadAttemptDate: new Date().toISOString(),
        errorMessage,
      };

      await this.channelOrderRepoService.update({
        where: { orderNumberErp },
        data: {
          guideTrackingDetail: updatedGuideTrackingDetail,
        },
      });

      this.logService.info(
        'Updated guideTrackingDetail with error',
        ErpShipmentService.name,
        { orderNumberErp, errorMessage },
      );
    } catch (error) {
      this.logService.error(
        'Error updating guideTrackingDetail with error information',
        ErpShipmentService.name,
        {
          orderNumberErp,
          error: error?.message,
        },
      );
      // Don't throw to avoid cascading failures
    }
  }
}
