import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import axios from 'axios';

import {
  AuditLogService,
  config,
  CustomException,
  ErrorCodes,
  ProcessLogService,
} from '@app/common';
import { StatusDetailKey } from '@app/common/consts/status-detail-key';
import {
  NonRetryableError,
  RetryableError,
} from '@app/common/enums/error-category.enum';
import {
  extractErrorMessage,
  shouldRetryError,
} from '@app/common/utils/error-handler.utility';
import { getGuideS3Key } from '@app/common/utils/guides.utility';
import { ChannelOrderRepoService } from '@app/database';
import { LogService } from '@app/log';
import { ChannelOrder, OrderStatus } from '@prisma/client';
import { RateLimiterService } from './rate-limiter.service';
import { S3Service } from './s3.service';

@Injectable()
export class YujuGuideService {
  private readonly yujuApiUrl: string;

  constructor(
    private readonly logService: LogService,
    private readonly channelOrderRepoService: ChannelOrderRepoService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly rateLimiterService: RateLimiterService,
    @Inject(forwardRef(() => AuditLogService))
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => ProcessLogService))
    private readonly processLogService: ProcessLogService,
  ) {
    this.yujuApiUrl = this.configService.get<string>('YUJU_API_URL');
  }

  /**
   * Obtiene la guía de envío de Yuju y la guarda en S3
   * @param orderId - ID de la orden en la base de datos
   * @throws NonRetryableError para errores de validación
   * @throws RetryableError para errores de red/API
   */
  async fetchAndSaveGuide(orderId: string): Promise<void> {
    this.logService.info('Fetching guide from Yuju', YujuGuideService.name, {
      orderId,
    });

    // Obtener información de la orden
    const order = await this.channelOrderRepoService.findUnique({
      where: { id: orderId },
      include: {
        channel: {
          include: {
            channelIntegrator: true,
          },
        },
      },
    });

    try {
      if (!order) {
        throw new CustomException(ErrorCodes.BAD_REQUEST, 'Order not found');
      }

      if (!order.shipmentDetail || typeof order.shipmentDetail !== 'object') {
        await this.handleValidationErrorAndSetWarning(
          order,
          'Shipment detail not found or invalid',
        );
        return;
      }

      const trackingNumber = order.shipmentDetail['tracking_number'];
      if (!trackingNumber) {
        await this.handleValidationErrorAndSetWarning(
          order,
          'Tracking number not found in shipment detail',
        );
        return;
      }

      const yujuChannelId = order.channel.partnerId;
      const yujuOrderId = order.ecommerceOrderId;

      if (!yujuChannelId || !yujuOrderId) {
        await this.handleValidationErrorAndSetWarning(
          order,
          'Yuju channel ID or order ID not found',
        );
        return;
      }

      if (!order.channel.channelIntegrator) {
        await this.handleValidationErrorAndSetWarning(
          order,
          'Channel integrator not found',
        );
        return;
      }

      if (
        !order.channel.channelIntegrator.config ||
        typeof order.channel.channelIntegrator.config !== 'object'
      ) {
        await this.handleValidationErrorAndSetWarning(
          order,
          'Channel integrator config not found or invalid',
        );
        return;
      }

      const token = order.channel.channelIntegrator.config['token'];
      if (!token) {
        await this.handleValidationErrorAndSetWarning(
          order,
          'Token not found in channel integrator config',
        );
        return;
      }

      // Llamar al endpoint de Yuju para obtener la guía
      const guideUrl = await this.fetchGuideFromYuju(
        orderId,
        yujuChannelId,
        yujuOrderId,
        token,
      );

      // Descargar el PDF de la guía
      const pdfBuffer = await this.downloadGuidePdf(guideUrl);

      // Guardar en S3 usando tracking_number como parte de la key
      const location = await this.saveGuideToS3(
        pdfBuffer,
        trackingNumber,
        order.channel.ecommerceType,
      );

      // Actualizar el shipmentDetail con información de la guía y remover el error
      const keyS3 = getGuideS3Key(trackingNumber, order.channel.ecommerceType);
      order.shipmentDetail['guide_url'] = guideUrl;

      const downloadDate = new Date().toISOString();

      order.shipmentDetail['guide_fetched_at'] = downloadDate;
      order.shipmentDetail['guide_s3_url'] = location;
      order.shipmentDetail['guide_s3_key'] = keyS3;

      order.guideTrackingDetail['downloadDate'] = downloadDate;
      order.guideTrackingDetail['lastDownloadAttemptDate'] = null;
      order.guideTrackingDetail['errorMessage'] = null;

      // Remover el error de statusDetail si existe
      const previousStatusDetail =
        typeof order.statusDetail === 'object' && order.statusDetail !== null
          ? { ...order.statusDetail }
          : {};
      const previousGuideTrackingDetail =
        typeof order.guideTrackingDetail === 'object' &&
        order.guideTrackingDetail !== null
          ? { ...order.guideTrackingDetail }
          : {};
      const previousStatus = order.status;

      const currentStatusDetail = { ...previousStatusDetail };
      if (StatusDetailKey.yuju_guide_fetch_error in currentStatusDetail) {
        delete currentStatusDetail[StatusDetailKey.yuju_guide_fetch_error];
      }

      const newStatus =
        Object.keys(currentStatusDetail).length === 0
          ? OrderStatus.PENDING
          : order.status;

      await this.channelOrderRepoService.update({
        where: { id: orderId },
        data: {
          shipmentDetail: order.shipmentDetail,
          guideTrackingDetail: order.guideTrackingDetail,
          shipmentGuideS3Key: keyS3,
          statusDetail: currentStatusDetail,
          status: newStatus,
        },
      });

      // Registrar actualización de guía en bitácora
      await this.auditLogService.logOrderGuideUpdate(
        orderId,
        {
          trackingNumber,
          guideUrl,
          s3Key: keyS3,
          downloadDate,
        },
        'SYSTEM' as any,
      );

      // Registrar cambio de estado si hubo cambio
      if (previousStatus !== newStatus) {
        await this.auditLogService.logOrderStatusChange(
          orderId,
          previousStatus,
          newStatus,
          'SYSTEM' as any,
        );
      }

      // Registrar cambio de subestatus si hubo cambio
      if (
        JSON.stringify(previousStatusDetail) !==
        JSON.stringify(currentStatusDetail)
      ) {
        await this.auditLogService.logOrderSubstatusChange(
          orderId,
          previousStatusDetail,
          currentStatusDetail,
          'SYSTEM' as any,
        );
      }

      this.logService.info(
        'Guide fetched and saved successfully',
        YujuGuideService.name,
        { orderId, trackingNumber },
      );

      // Registrar éxito en bitácora de procesos
      await this.processLogService.logDownloadGuide(
        orderId,
        'SUCCESS' as any,
        undefined,
        {
          trackingNumber,
          guideUrl,
          s3Key: keyS3,
        },
      );
    } catch (error) {
      // Registrar error en bitácora de procesos
      const errorMessage = error?.message || 'Unknown error';
      await this.processLogService.logDownloadGuide(
        orderId,
        'ERROR' as any,
        {
          message: errorMessage,
          stack: error?.stack,
        },
        {
          orderId,
        },
      );

      await this.handleAndThrowError(order, error);
    }
  }

  /**
   * Maneja el error y lo re-lanza clasificado
   * @param order - Orden afectada
   * @param error - Error capturado
   * @throws NonRetryableError o RetryableError
   */
  private async handleAndThrowError(
    order: ChannelOrder,
    error: any,
  ): Promise<never> {
    const errorMessage = extractErrorMessage(error);
    const isRetryable = shouldRetryError(error);

    // Guardar en base de datos
    if (order) {
      order.guideTrackingDetail['lastDownloadAttemptDate'] =
        new Date().toISOString();
      order.guideTrackingDetail['errorMessage'] = errorMessage;
      order.guideTrackingDetail['isRetryable'] = isRetryable;
      await this.channelOrderRepoService.update({
        where: { id: order.id },
        data: {
          guideTrackingDetail: order.guideTrackingDetail,
        },
      });
    }

    // Log del error
    this.logService.error(
      'Error fetching guide from Yuju',
      YujuGuideService.name,
      {
        orderId: order?.id,
        error: errorMessage,
        isRetryable,
        stack: error.stack,
      },
    );

    // Re-lanzar como NonRetryableError o RetryableError
    if (isRetryable) {
      throw new RetryableError(errorMessage, error);
    } else {
      throw new NonRetryableError(errorMessage, error);
    }
  }

  /**
   * Llama al endpoint de Yuju para obtener la URL de la guía
   * @param dbOrderId - ID de la orden en la base de datos
   * @param channelId - ID del canal en Yuju
   * @param orderId - ID de la orden en Yuju
   * @param token - Token de autenticación del ChannelIntegrator
   * @returns URL del PDF de la guía
   */
  private async fetchGuideFromYuju(
    dbOrderId: string,
    channelId: string,
    orderId: string,
    token: string,
  ): Promise<string> {
    try {
      const url = `${this.yujuApiUrl}/orders/labels`;
      const params = {
        id_channel: channelId,
        id_order: orderId,
      };
      const body = {
        format: 'general', // Retorna PDF
      };

      this.logService.info(
        'Calling Yuju API to fetch guide',
        YujuGuideService.name,
        { url, params, body },
      );

      // Aplicar rate limiting antes de hacer la petición a Yuju
      await this.rateLimiterService.waitForNextAvailableSlot();

      const response = await axios.post(url, body, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.data || !response.data.url) {
        throw new CustomException(
          ErrorCodes.BAD_REQUEST,
          'Invalid response from Yuju API - no URL returned',
        );
      }

      return response.data.url;
    } catch (error) {
      // Actualizar statusDetail con el error
      await this.updateOrderStatusDetailWithError(
        dbOrderId,
        error.response?.data?.message || error.message,
      );

      this.logService.error('Error calling Yuju API', YujuGuideService.name, {
        channelId,
        orderId,
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Descarga el PDF de la guía desde la URL proporcionada por Yuju
   * @param url - URL del PDF
   * @returns Buffer con el contenido del PDF
   */
  private async downloadGuidePdf(url: string): Promise<Buffer> {
    try {
      this.logService.info('Downloading guide PDF', YujuGuideService.name, {
        url,
      });

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logService.error(
        'Error downloading guide PDF',
        YujuGuideService.name,
        {
          url,
          error: error.message,
        },
      );
      throw error;
    }
  }

  /**
   * Guarda la guía en S3
   * @param pdfBuffer - Buffer con el contenido del PDF
   * @param trackingNumber - Número de guía/tracking
   * @param ecommerceType - Tipo de ecommerce
   */
  private async saveGuideToS3(
    pdfBuffer: Buffer,
    trackingNumber: string,
    ecommerceType: string,
  ): Promise<string> {
    try {
      const bucket = config.BUCKET_INVENTORY_FILES;
      const key = getGuideS3Key(trackingNumber, ecommerceType);

      this.logService.info('Saving guide to S3', YujuGuideService.name, {
        bucket,
        key,
        trackingNumber,
      });

      const location = await this.s3Service.uploadFile(
        bucket,
        key,
        pdfBuffer,
        'application/pdf',
      );

      this.logService.info(
        'Guide saved to S3 successfully',
        YujuGuideService.name,
        { bucket, key, trackingNumber },
      );

      return location;
    } catch (error) {
      this.logService.error('Error saving guide to S3', YujuGuideService.name, {
        trackingNumber,
        ecommerceType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Maneja errores de validación antes de llamar a la API de Yuju
   * Actualiza el estado de la orden a WARNING y registra el error
   * @param order - Orden ya cargada (con includes necesarios)
   * @param errorMessage - Mensaje de error descriptivo
   */
  private async handleValidationErrorAndSetWarning(
    order: ChannelOrder,
    errorMessage: string,
  ): Promise<void> {
    try {
      // Preparar guideTrackingDetail actualizado
      const updatedGuideTrackingDetail = {
        ...(order.guideTrackingDetail as Record<string, any> || {}),
        lastDownloadAttemptDate: new Date().toISOString(),
        errorMessage: errorMessage,
        isRetryable: false, // Errores de validación no son retryables
      };

      // Obtener el statusDetail actual
      const currentStatusDetail =
        typeof order.statusDetail === 'object' && order.statusDetail !== null
          ? { ...order.statusDetail }
          : {};

      // Agregar o actualizar el error de guía de Yuju
      currentStatusDetail[StatusDetailKey.yuju_guide_fetch_error] =
        errorMessage;

      // Actualizar la orden con todo en una sola operación
      await this.channelOrderRepoService.update({
        where: { id: order.id },
        data: {
          statusDetail: currentStatusDetail,
          guideTrackingDetail: updatedGuideTrackingDetail,
          status:
            order.status === OrderStatus.PENDING ||
            order.status === OrderStatus.IN_EVALUATION
              ? OrderStatus.WARNING
              : order.status,
        },
      });

      this.logService.warn(
        'Validation error detected, order status set to WARNING',
        YujuGuideService.name,
        { orderId: order.id, errorMessage },
      );
    } catch (error) {
      this.logService.error(
        'Error updating order with validation error',
        YujuGuideService.name,
        {
          orderId: order.id,
          error: error.message,
          originalError: errorMessage,
        },
      );
    }
  }

  /**
   * Actualiza el statusDetail de la orden con el error de obtención de guía de Yuju
   * @param orderId - ID de la orden en la base de datos
   * @param errorMessage - Mensaje de error
   */
  private async updateOrderStatusDetailWithError(
    orderId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const order = await this.channelOrderRepoService.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return;
      }

      // Obtener el statusDetail actual
      const currentStatusDetail =
        typeof order.statusDetail === 'object' && order.statusDetail !== null
          ? { ...order.statusDetail }
          : {};

      // Agregar o actualizar el error de guía de Yuju
      currentStatusDetail[StatusDetailKey.yuju_guide_fetch_error] =
        errorMessage;

      // Actualizar la orden con el nuevo statusDetail y cambiar status a WARNING si es necesario
      await this.channelOrderRepoService.update({
        where: { id: orderId },
        data: {
          statusDetail: currentStatusDetail,
          status:
            order.status === OrderStatus.PENDING ||
            order.status === OrderStatus.IN_EVALUATION
              ? OrderStatus.WARNING
              : order.status,
        },
      });

      this.logService.info(
        'Order statusDetail updated with Yuju guide fetch error',
        YujuGuideService.name,
        { orderId, errorMessage },
      );
    } catch (error) {
      this.logService.error(
        'Error updating order statusDetail',
        YujuGuideService.name,
        {
          orderId,
          error: error.message,
        },
      );
    }
  }
}
