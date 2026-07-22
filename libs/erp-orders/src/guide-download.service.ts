import {
  CustomException,
  DeliveryStatusKey,
  ErrorCodes,
  OrderData,
  ProcessLogService,
  YujuGuideService,
} from '@app/common';
import { ChannelOrderRepoService } from '@app/database';
import { LogService } from '@app/log';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShipmentOrigin } from '@prisma/client';
import axios from 'axios';
import { ErpShipmentService } from './erp-shipment.service';

@Injectable()
export class GuideDownloadService {
  private readonly apiRestErpUrl: string;

  constructor(
    private readonly logService: LogService,
    private readonly channelOrderRepoService: ChannelOrderRepoService,
    private readonly yujuGuideService: YujuGuideService,
    private readonly erpShipmentService: ErpShipmentService,
    private readonly configService: ConfigService,
    private readonly processLogService: ProcessLogService,
  ) {
    this.apiRestErpUrl = this.configService.get<string>(
      'API_REST_NEXT_CLOUD_URL',
    );
  }

  /**
   * Unified method to download guide from Yuju or ERP based on shipmentOrigin
   * @param orderId - Order ID
   */
  async downloadGuide(orderId: string): Promise<void> {
    this.logService.info(
      'Starting unified guide download',
      GuideDownloadService.name,
      {
        orderId,
      },
    );

    // Get order with necessary relations
    const order = await this.channelOrderRepoService.findUnique({
      where: { id: orderId },
      include: {
        channel: {
          include: {
            channelIntegrator: true,
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

    if (!order) {
      const errorMsg = 'Order not found';
      this.logService.error(
        'Error downloading guide',
        GuideDownloadService.name,
        { orderId, error: errorMsg },
      );
      throw new CustomException(ErrorCodes.BAD_REQUEST, errorMsg);
    }

    // Check if guide already exists
    if (order.shipmentGuideS3Key) {
      const warnMsg = 'Order already has a guide generated';
      this.logService.warn(warnMsg, GuideDownloadService.name, {
        orderId,
        guideKey: order.shipmentGuideS3Key,
      });
      throw new CustomException(ErrorCodes.BAD_REQUEST, warnMsg);
    }

    // Route based on shipmentOrigin
    try {
      if (order.shipmentOrigin === ShipmentOrigin.YUJU) {
        await this.downloadGuideFromYuju(orderId);
      } else if (order.shipmentOrigin === ShipmentOrigin.NEXT) {
        await this.downloadGuideFromErp(order);
      } else {
        const errorMsg = `Unsupported shipmentOrigin: ${order.shipmentOrigin}`;
        throw new CustomException(ErrorCodes.BAD_REQUEST, errorMsg);
      }

      this.logService.info(
        'Guide downloaded successfully',
        GuideDownloadService.name,
        { orderId, shipmentOrigin: order.shipmentOrigin },
      );

      // Registrar éxito en bitácora de procesos (si no fue registrado por el servicio interno)
      await this.processLogService.logDownloadGuide(
        orderId,
        'SUCCESS' as any,
        undefined,
        {
          shipmentOrigin: order.shipmentOrigin,
        },
      );
    } catch (error) {
      // Registrar error en bitácora de procesos
      await this.processLogService.logDownloadGuide(
        orderId,
        'ERROR' as any,
        {
          message: error?.message || 'Unknown error',
          stack: error?.stack,
        },
        {
          orderId,
          shipmentOrigin: order?.shipmentOrigin,
        },
      );

      // Ensure we track the attempt failure if it wasn't handled by inner services
      // Inner services (YujuGuideService, ErpShipmentService) handle their own errors and update DB,
      // but we need to catch errors that might happen before calling them or in the wrapper logic.
      await this.handleError(orderId, error);
      throw error;
    }
  }

  private async handleError(orderId: string, error: any): Promise<void> {
    try {
      const errorMessage = error.message || 'Unknown error downloading guide';

      // Fetch order again to get current guideTrackingDetail
      const order = await this.channelOrderRepoService.findUnique({
        where: { id: orderId },
        select: { guideTrackingDetail: true },
      });

      if (order) {
        const guideTrackingDetail =
          (order.guideTrackingDetail as Record<string, any>) || {};

        // Only update if not already updated recently (to avoid double updates if inner service already handled it)
        // We can check if lastDownloadAttemptDate is very recent (e.g. last 1 second)
        const lastAttempt = guideTrackingDetail['lastDownloadAttemptDate'];
        const now = new Date();
        const isRecent =
          lastAttempt && now.getTime() - new Date(lastAttempt).getTime() < 5000;

        if (!isRecent) {
          await this.channelOrderRepoService.update({
            where: { id: orderId },
            data: {
              guideTrackingDetail: {
                ...guideTrackingDetail,
                lastDownloadAttemptDate: now.toISOString(),
                errorMessage,
              },
            },
          });
        }
      }
    } catch (e) {
      this.logService.error(
        'Error updating guide tracking detail',
        GuideDownloadService.name,
        { orderId, error: e.message },
      );
    }
  }

  /**
   * Download guide from Yuju
   * @param orderId - Order ID
   */
  private async downloadGuideFromYuju(orderId: string): Promise<void> {
    this.logService.info(
      'Downloading guide from Yuju',
      GuideDownloadService.name,
      { orderId },
    );

    await this.yujuGuideService.fetchAndSaveGuide(orderId);
  }

  /**
   * Download guide from ERP (Next Cloud)
   * @param order - Order with relations
   */
  private async downloadGuideFromErp(order: any): Promise<void> {
    this.logService.info(
      'Downloading guide from ERP',
      GuideDownloadService.name,
      { orderId: order.id, orderNumberErp: order.orderNumberErp },
    );

    // Validate required fields
    if (!order.orderNumberErp) {
      throw new CustomException(
        ErrorCodes.BAD_REQUEST,
        'Order does not have orderNumberErp',
      );
    }

    // Get ERP token from logistic provider credentials
    const baseCredentials =
      order.channel.user?.accountSettings?.logisticProviderCredentials;

    if (!baseCredentials?.token) {
      throw new CustomException(
        ErrorCodes.BAD_REQUEST,
        'ERP token not found in logistic provider credentials',
      );
    }

    const apiRestErpToken = baseCredentials.token;

    // Get delivery details from ERP
    const shipmentsErpDetail = await this.getDeliveryDetailsFromErp(
      order.orderNumberErp,
      order.partnerId,
      order.ecommerceOrderId,
      order.shipmentOrigin,
      order.channel.ecommerceType,
      apiRestErpToken,
    );

    // Download shipment using ErpShipmentService
    // This method will update shipmentDetail, guideTrackingDetail, and shipmentGuideS3Key
    await this.erpShipmentService.downloadShipmentErp(
      shipmentsErpDetail,
      apiRestErpToken,
    );
  }

  /**
   * Get delivery details from ERP API
   * @param orderNumberErp - Order number in ERP
   * @param partnerId - Partner ID
   * @param ecommerceOrderId - Ecommerce order ID
   * @param shipmentOrigin - Shipment origin
   * @param ecommerceType - Ecommerce type
   * @param apiRestErpToken - ERP API token
   * @returns Shipment details grouped by delivery status
   */
  private async getDeliveryDetailsFromErp(
    orderNumberErp: string,
    partnerId: string,
    ecommerceOrderId: string,
    shipmentOrigin: ShipmentOrigin,
    ecommerceType: string,
    apiRestErpToken: string,
  ): Promise<Record<DeliveryStatusKey, Array<OrderData>>> {
    try {
      const data = JSON.stringify({
        tipo_consulta: 'ORDCO',
        folios: [orderNumberErp],
      });

      this.logService.info(
        'Fetching delivery details from ERP',
        GuideDownloadService.name,
        { orderNumberErp, data },
      );

      const response = await axios.post(
        `${this.apiRestErpUrl}/rest/next/core/shipments/deliveries/details`,
        data,
        {
          headers: {
            Authorization: apiRestErpToken,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data?.pedidos || response.data.pedidos.length === 0) {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'No delivery details found in ERP response',
        );
      }

      // Transform response to shipmentsErpDetail format
      const shipmentsErpDetail = response.data.pedidos.reduce(
        (acc, order) => {
          if (
            order.numero_orden === orderNumberErp &&
            order.entregas?.length > 0
          ) {
            acc[order.clave_estado_embarque] = [
              ...(acc[order.clave_estado_embarque] || []),
              {
                orderNumberErp: order.numero_orden,
                partnerId,
                ecommerceOrderId,
                shipmentOrigin,
                ecommerceType,
                delivery: order.entregas[0],
              },
            ];
          }
          return acc;
        },
        {} as Record<DeliveryStatusKey, Array<OrderData>>,
      );

      if (Object.keys(shipmentsErpDetail).length === 0) {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'No valid shipment details found for order',
        );
      }

      return shipmentsErpDetail;
    } catch (error) {
      this.logService.error(
        'Error fetching delivery details from ERP',
        GuideDownloadService.name,
        {
          orderNumberErp,
          error: error.message,
          response: error.response?.data,
        },
      );
      throw error;
    }
  }
}
