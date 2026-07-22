import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import axios from 'axios';

import { config, CustomException, ErrorCodes } from '@app/common';
import { extractErrorMessage } from '@app/common/utils/error-handler.utility';
import { ChannelOrderRepoService } from '@app/database';
import { LogService } from '@app/log';

import { ChannelOrder, ShipmentOrigin } from '@prisma/client';
import { S3Service } from './s3.service';

@Injectable()
export class ErpShipmentService {
  private readonly apiRestErpUrl: string;

  constructor(
    private readonly logService: LogService,
    private readonly channelOrderRepoService: ChannelOrderRepoService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {
    this.apiRestErpUrl = this.configService.get<string>(
      'API_REST_NEXT_CLOUD_URL',
    );
  }

  /**
   * Send the guide to Next only if it has a guide in Yuju
   * @param orderId - Order ID
   * @throws NonRetryableError para errores de validación
   * @throws RetryableError para errores de red/API
   */
  async sendShipmentToErp(orderId: string): Promise<void> {
    this.logService.info(
      'SendShipmentToErp - Iniciando',
      ErpShipmentService.name,
      { orderId },
    );

    const order = await this.channelOrderRepoService.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        channel: {
          include: {
            channelConfigurationERP: true,
            user: {
              include: {
                accountSettings: {
                  include: {
                    logisticProviderCredentials: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    try {
      if (!order) {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'sendShipmentToErp - Orders to process not found',
        );
      }

      if (order.shipmentOrigin !== ShipmentOrigin.YUJU) {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'sendShipmentToErp - The origin of the guide is not YUJU',
        );
      }

      // Merge logistic credentials: base from user + override from channel
      const baseCredentials =
        order.channel.user?.accountSettings?.logisticProviderCredentials;
      const logisticProviderCredentials = this.mergeLogisticCredentials(
        baseCredentials,
        order.channel.channelConfigurationERP,
      );

      if (!order.shipmentDetail) {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'sendShipmentToErp - Shipment detail not found',
        );
      }
      if (typeof order.shipmentDetail !== 'object') {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'sendShipmentToErp - Shipment detail is not an object',
        );
      }
      if (!order.shipmentDetail['tracking_number']) {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'sendShipmentToErp - Tracking number not found',
        );
      }

      // Extract delivery_folio from shipmentDetail
      if (!order.shipmentDetail['delivery_folio']) {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'sendShipmentToErp - Delivery folio (entrega) not found in shipment detail',
        );
      }

      const entrega = order.shipmentDetail['delivery_folio'];
      const trackingNumber = order.shipmentDetail['tracking_number'];
      const label = await this.downloadLabelS3(order.shipmentGuideS3Key);

      const pdfBase64 = label.toString('base64');
      const response = await axios.put(
        `${this.apiRestErpUrl}/rest/next/third-party/ocreativas/entrega/${entrega}`,
        {
          guia: trackingNumber,
          pdf: pdfBase64,
        },
        {
          headers: {
            Authorization: `${logisticProviderCredentials.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logService.info(
        'SendShipmentToErp - Response',
        ErpShipmentService.name,
        {
          orderId,
          response: response.data,
          trackingNumber,
          entrega,
          order,
        },
      );

      const statusCode = response.status;
      order.shipmentDetail['shipment_confirmed_in_erp'] = statusCode === 200;
      order.guideTrackingDetail['uploadDateToERP'] = new Date().toISOString();
      order.guideTrackingDetail['lastUploadAttemptDate'] = null;
      order.guideTrackingDetail['errorMessage'] = null;

      const data = {
        shipmentDetail: order.shipmentDetail,
        guideTrackingDetail: order.guideTrackingDetail,
      };

      this.logService.info(
        'SendShipmentToErp - Updating order',
        ErpShipmentService.name,
        {
          orderId,
          data,
        },
      );

      const orderUpdated = await this.channelOrderRepoService.update({
        where: { id: orderId },
        data,
      });

      this.logService.info(
        'SendShipmentToErp - successful',
        ErpShipmentService.name,
        {
          orderId,
          orderUpdated,
        },
      );
    } catch (error) {
      await this.handleAndThrowError(order, error);
    }
  }

  /**
   * Maneja el error y lo re-lanza clasificado
   * @param order - Orden afectada
   * @param error - Error capturado
   * @throws NonRetryableError o RetryableError
   */
  private async handleAndThrowError(order: ChannelOrder, error: any) {
    const errorMessage = extractErrorMessage(error);

    // Guardar en base de datos
    if (order) {
      order.guideTrackingDetail['lastUploadAttemptDate'] =
        new Date().toISOString();
      order.guideTrackingDetail['errorMessage'] = errorMessage;
      await this.channelOrderRepoService.update({
        where: { id: order.id },
        data: {
          guideTrackingDetail: order.guideTrackingDetail,
        },
      });
    }

    // Log del error
    this.logService.error(
      'Error in sendShipmentToErp',
      ErpShipmentService.name,
      {
        orderId: order?.id,
        error: errorMessage,
        stack: error.stack,
      },
    );
  }

  /**
   * Downloads a label from S3
   * @param s3Key - S3 key of the label
   * @returns Buffer with the PDF content
   */
  async downloadLabelS3(s3Key: string): Promise<Buffer> {
    const bucket = config.BUCKET_INVENTORY_FILES;
    return this.s3Service.downloadFile(bucket, s3Key);
  }

  /**
   * Merges base logistic provider credentials with channel-specific ERP configuration.
   * Selects the appropriate courier based on the shipment origin.
   *
   * @param baseCredentials - LogisticProviderCredentials from user's AccountSettings
   * @param channelConfigERP - ChannelConfigurationERP specific to the channel
   * @param shipmentOrigin - Origin of the shipment (YUJU or NEXT)
   * @returns Merged credentials with channel overrides and dynamic courier selection
   */
  public mergeLogisticCredentials(
    baseCredentials: any,
    channelConfigERP: any,
    shipmentOrigin?: string,
  ) {
    // If no base credentials, cannot proceed
    if (!baseCredentials) {
      this.logService.warn(
        'No base logistic credentials found for user',
        ErpShipmentService.name,
      );
      return null;
    }

    // If no channel-specific config, return base credentials as-is
    if (!channelConfigERP) {
      return baseCredentials;
    }

    // Determine which courier to use based on shipmentOrigin
    let courierId = baseCredentials.courierId;
    let courierName = baseCredentials.courierName;

    if (shipmentOrigin === 'YUJU') {
      // Use integrator courier if available, otherwise fallback to base
      courierId =
        channelConfigERP.courierIdIntegrator || baseCredentials.courierId;
      courierName =
        channelConfigERP.courierNameIntegrator || baseCredentials.courierName;
    } else if (shipmentOrigin === 'NEXT') {
      // Use ERP courier if available, otherwise fallback to base
      courierId = channelConfigERP.courierIdErp || baseCredentials.courierId;
      courierName =
        channelConfigERP.courierNameErp || baseCredentials.courierName;
    }
    // If no shipmentOrigin provided, use base credentials (already set)

    // Merge: base credentials with channel-specific overrides
    return {
      ...baseCredentials,
      courierId,
      courierName,
      storeId: channelConfigERP.storeId,
      storeName: channelConfigERP.storeName,
      sourceId: channelConfigERP.sourceId,
      sourceName: channelConfigERP.sourceName,
      syncPrices: channelConfigERP.syncPrices,
    };
  }
}
