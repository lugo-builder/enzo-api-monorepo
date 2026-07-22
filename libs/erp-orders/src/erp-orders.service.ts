import {
  CustomException,
  DeliveryStatusKey,
  EcommerceOrderStatus,
  ErrorCodes,
  ExcludedStatuses,
  getGuideS3Key,
  OrderData,
  orderErpWhere,
  PublisherService,
  QUEUES,
  S3Service,
  StatusDetailKey,
} from '@app/common';
import { ErpShipmentService as CommonErpShipmentService } from '@app/common/services/erp-shipment.service';
import { ProcessHistoryService } from '@app/common/services/process-history.service';
import { YujuService } from '@app/common/services/yuju.service';
import { ZplService } from '@app/common/services/zpl.service';
import { ChannelOrderRepoService, DatabaseService } from '@app/database';
import { LogService } from '@app/log';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChannelOrder,
  ChannelOrderItem,
  OrderStatus,
  ShipmentOrigin,
} from '@prisma/client';
import axios from 'axios';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecipientAddressDto } from './dto/recipient-address.dto';
import { RecipientDto } from './dto/recipient.dto';
import { ErpShipmentService } from './erp-shipment.service';
import { Order } from './types/order';
import { ResponseOrders } from './types/shipping-and-deliveries';

@Injectable()
export class ErpOrdersService {
  private readonly apiRestErpUrl: string;
  private readonly erpInventoryFactor: number;

  constructor(
    private readonly logService: LogService,
    private readonly configService: ConfigService,
    private readonly publisherService: PublisherService,
    private readonly channelOrderRepoService: ChannelOrderRepoService,
    private readonly processHistoryService: ProcessHistoryService,
    private readonly prisma: DatabaseService,
    private readonly s3Service: S3Service,
    private readonly zplService: ZplService,
    private readonly yujuService: YujuService,
    private readonly erpShipmentService: ErpShipmentService,
    private readonly commonErpShipmentService: CommonErpShipmentService,
  ) {
    this.apiRestErpUrl = this.configService.get<string>(
      'API_REST_NEXT_CLOUD_URL',
    );
    this.erpInventoryFactor = this.configService.get<number>(
      'ERP_INVENTORY_FACTOR',
    );
  }

  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.channelOrderRepoService.findUnique({
      where: {
        channel: {
          channelConfigurationERP: { isNot: null },
        },
        id: orderId,
        status: {
          in: [
            OrderStatus.IN_EVALUATION,
            OrderStatus.PENDING,
            OrderStatus.WARNING,
            OrderStatus.FAILED,
          ],
        },
      },
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

    if (!order) {
      return null;
    }

    // Merge logistic credentials: base from user + override from channel
    const baseCredentials =
      order.channel.user?.accountSettings?.logisticProviderCredentials;
    const mergedCredentials =
      this.commonErpShipmentService.mergeLogisticCredentials(
        baseCredentials,
        order.channel.channelConfigurationERP,
        order.shipmentOrigin,
      );

    return {
      ...order,
      recipient: plainToInstance(RecipientDto, order.recipient),
      recipientAddress: plainToInstance(
        RecipientAddressDto,
        order.recipientAddress,
      ),
      channel: {
        ...order.channel,
        logisticProviderCredentials: mergedCredentials,
      },
    };
  }

  async getInEvaluationOrdersByChannel(channelId: string): Promise<Order[]> {
    const orders = await this.channelOrderRepoService.findMany({
      where: {
        ...orderErpWhere,
        channelId,
        status: { in: [OrderStatus.IN_EVALUATION, OrderStatus.PENDING] },
      },
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

    if (!orders || orders.length === 0) {
      return [];
    }

    return orders.map((order) => {
      // Merge logistic credentials: base from user + override from channel
      const baseCredentials =
        order.channel.user?.accountSettings?.logisticProviderCredentials;
      const mergedCredentials =
        this.commonErpShipmentService.mergeLogisticCredentials(
          baseCredentials,
          order.channel.channelConfigurationERP,
        );

      return {
        ...order,
        recipient: plainToInstance(RecipientDto, order.recipient),
        recipientAddress: plainToInstance(
          RecipientAddressDto,
          order.recipientAddress,
        ),
        channel: {
          ...order.channel,
          logisticProviderCredentials: mergedCredentials,
        },
      };
    });
  }

  async validateInventoryAndSendOrdersFromIntegratorsByUserId(
    userId: string,
  ): Promise<void> {
    const orders = await this.channelOrderRepoService.findMany({
      where: {
        deletedAt: null,
        status: OrderStatus.PENDING,
        ecommerceOrderStatus: { not: 'close' },
        channel: {
          userId,
          deletedAt: null,
          user: {
            accountSettings: {
              logisticProviderCredentialsId: { not: null },
              isSkipToSendOrder: false,
            },
          },
        },
        items: {
          every: {
            sku: {
              not: null,
            },
          },
        },
      },
      include: {
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
        items: true,
      },
    });

    // Validate inventory and send orders to ERP
    for (const order of orders) {
      const { items } = order;

      // Merge logistic credentials: base from user + override from channel
      const baseCredentials =
        order.channel.user?.accountSettings?.logisticProviderCredentials;
      const mergedCredentials =
        this.commonErpShipmentService.mergeLogisticCredentials(
          baseCredentials,
          order.channel.channelConfigurationERP,
        );

      if (!mergedCredentials) {
        this.logService.warn(
          'No logistic credentials found for order',
          ErpOrdersService.name,
          { orderId: order.id },
        );
        continue;
      }

      const inventoryOk = await this.validateInventory(
        mergedCredentials.warehouseId,
        items,
        mergedCredentials.token,
      );

      if (inventoryOk) {
        await this.sendOrderToErp(order);
      }
    }
  }

  // TODO: Deprecated method, remove it
  async validateAndSendOrdersByChannelId(
    channelId: string,
    resetRetries: boolean = false,
  ): Promise<void> {
    const orders = await this.getInEvaluationOrdersByChannel(channelId);
    if (!orders || orders.length === 0) {
      return;
    }

    const chunkSize = 5;
    const orderChunks = this.chunkArray(orders, chunkSize);

    for (const chunk of orderChunks) {
      const promises = chunk.map((order) =>
        this.validateAndSendOrder(order, resetRetries),
      );
      await Promise.all(promises);
    }
  }

  async validateAndSendOrderById(
    orderId: string,
    resetRetries: boolean = false,
  ): Promise<void> {
    const order = await this.getOrderById(orderId);
    if (!order) {
      this.logService.warn(
        'Order not found to process',
        ErpOrdersService.name,
        {
          orderId: orderId,
          date: new Date().toISOString(),
        },
      );
      return;
    }
    await this.validateAndSendOrder(order, resetRetries);
  }

  async validateAndSendOrder(
    order: Order,
    resetRetries: boolean = false,
    updateStatus: boolean = true,
  ): Promise<void> {
    try {
      // SCRUM-495: No enviar órdenes con estatus excluidos al ERP
      if (
        ExcludedStatuses.includes(
          order.ecommerceOrderStatus as EcommerceOrderStatus,
        )
      ) {
        this.logService.warn(
          'Order not sent to ERP due to excluded status',
          ErpOrdersService.name,
          {
            orderId: order.id,
            ecommerceOrderId: order.ecommerceOrderId,
            ecommerceOrderStatus: order.ecommerceOrderStatus,
            reason: 'Order has excluded status (canceled/refunded/delivered)',
          },
        );
        return;
      }

      // Validar si el envío de órdenes está deshabilitado
      const shouldSkipSending =
        order.channel?.user?.accountSettings?.isSkipToSendOrder === true;

      if (shouldSkipSending) {
        this.logService.warn(
          'Order not sent to ERP due to skip sending configuration',
          ErpOrdersService.name,
          {
            orderId: order.id,
            ecommerceOrderId: order.ecommerceOrderId,
            reason: 'User has isSkipToSendOrder enabled in account settings',
          },
        );
        return;
      }

      if (order.folioNext && order.folioNext.trim() !== '') {
        this.logService.warn(
          `Order with ID: ${order.id} already has a folioNext`,
          ErpOrdersService.name,
          new Date().toISOString(),
        );
        return;
      }
      const { isValid } = await this.validateOrder(order);

      this.logService.info('Order validation result', ErpOrdersService.name, {
        orderId: order.id,
        isValid,
      });

      if (isValid) {
        if (resetRetries) {
          await this.channelOrderRepoService.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PENDING,
              statusDetail: {},
              failedAttempts: 0,
              retryTime: null,
            },
          });
        } else if (order.status !== OrderStatus.PENDING && updateStatus) {
          // Clear any leftover validation messages when moving to PENDING
          await this.clearValidationMessages(order.id);
          await this.channelOrderRepoService.update({
            where: { id: order.id },
            data: { status: OrderStatus.PENDING },
          });
        }

        await this.sendOrderToErp(order);
      } else {
        this.logService.warn(
          `Order with ID: ${order.id} is not eligible to send message to SQS`,
          ErpOrdersService.name,
          new Date().toISOString(),
        );
      }
    } catch (error) {
      this.logService.error(
        'Error executing validateAndSendOrder',
        ErpOrdersService.name,
        { orderId: order.id, error },
      );
    }
  }

  async validateOrder(order: Order): Promise<{ isValid: boolean }> {
    let response = { isValid: false };
    try {
      const hasItems = Array.isArray(order?.items) && order.items.length > 0;
      if (!hasItems) {
        return { isValid: false };
      }

      // Validate required recipient and address fields
      const recipient = plainToInstance(RecipientDto, order.recipient);
      const recipientAddress = plainToInstance(
        RecipientAddressDto,
        order.recipientAddress,
      );

      const [recipientErrors, recipientAddressErrors] = await Promise.all([
        validate(recipient),
        validate(recipientAddress),
      ]);

      let isRecipientValid = recipientErrors.length === 0;
      let isRecipientAddressValid = recipientAddressErrors.length === 0;

      // Check that all items have ERP SKU
      const hasMissingSku = order.items.some((item) => !item.sku);

      // Collect all validation errors
      const validationErrors: Array<{
        type: string;
        userMessage: string;
        technicalMessage: string;
      }> = [];

      // Add validation errors to collection
      if (hasMissingSku) {
        validationErrors.push({
          type: StatusDetailKey.missing_sku as any,
          userMessage: 'Se encontraron productos sin el SKU del ERP',
          technicalMessage: 'Orden con artículos sin SKU del ERP',
        });
      }

      if (!isRecipientValid) {
        validationErrors.push({
          type: StatusDetailKey.invalid_recipient as any,
          userMessage: 'Información incompleta del destinatario',
          technicalMessage: 'Validación de destinatario fallida',
        });
      }

      if (!isRecipientAddressValid) {
        validationErrors.push({
          type: StatusDetailKey.invalid_recipient_address as any,
          userMessage:
            'Información incompleta de la dirección del destinatario',
          technicalMessage: 'Validación de dirección de destinatario fallida',
        });
      }

      // Only check inventory if structural validations passed and SKUs exist
      if (!hasMissingSku && isRecipientValid && isRecipientAddressValid) {
        const { items } = order;
        const inventoryOk = await this.validateInventory(
          order.channel.logisticProviderCredentials.warehouseId,
          items,
          order.channel.logisticProviderCredentials.token,
        );
        if (!inventoryOk) {
          validationErrors.push({
            type: StatusDetailKey.erp_item_inventory_message,
            userMessage:
              'Los artículos de la orden no cuentan con inventario suficiente',
            technicalMessage:
              'Es necesario solicitar al ERP asigne más inventario a los artículos de la orden',
          });
        } else {
          response.isValid = true;
        }
      }

      // If there are validation errors, propagate them all at once
      if (validationErrors.length > 0) {
        await this.propagateMultipleErrors(order, validationErrors);
        response.isValid = false;
      }
    } catch (error) {
      this.logService.error(
        'Error executing scheduled task: Send message to SQS',
        ErpOrdersService.name,
        error,
      );
    }
    return response;
  }

  async validateInventory(
    warehouseId: string,
    items: ChannelOrderItem[],
    apiRestErpToken: string,
  ): Promise<boolean> {
    let isGlobalValid = false;
    try {
      // Asegurar que todos los SKUs sean strings y eliminar duplicados
      const skus = [...new Set(items.map((item) => String(item.sku)))];

      const response = await axios.post(
        `${this.apiRestErpUrl}/rest/next/core/inventories/warehouse/${warehouseId}/items`,
        { tipo: 'todo', skus },
        {
          headers: {
            Authorization: `${apiRestErpToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logService.info(
        'Response from inventory validation',
        ErpOrdersService.name,
        response.data,
      );

      if (response?.data?.error === 0) {
        const inventory = response.data.datos;
        const inventoryMap = new Map<string, number>();
        // Asegurar que el SKU del inventario siempre sea string
        for (const item of inventory) {
          inventoryMap.set(String(item.sku), item.disponible_sugerido);
        }

        const result = items.map((item) => {
          // Convertir el SKU a string al buscar en el Map
          const itemSku = String(item.sku);
          const exist = inventoryMap.get(itemSku) ?? 0;
          const isValid =
            exist >= Number(this.erpInventoryFactor) + Number(item.quantity);

          return {
            ...item,
            exist,
            isValid,
            mensaje: isValid
              ? 'Cantidad permitida'
              : `Cantidad no permitida (existencia para el SKU ${itemSku} debe ser al menos: ${Number(this.erpInventoryFactor) + Number(item.quantity)})`,
          };
        });

        this.logService.info(
          'Result from inventory validation',
          ErpOrdersService.name,
          result,
        );
        isGlobalValid = result.every((item) => item.isValid);
      }

      return isGlobalValid;
    } catch (error) {
      this.logService.error(
        'Error in validateInventory',
        ErpOrdersService.name,
        error?.response?.data,
      );
      throw new CustomException(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Inventory validation failed',
      );
    }
  }

  async sendOrderToErp(order: ChannelOrder): Promise<void> {
    await this.publisherService.publishMessage(
      QUEUES.ERP.erp_sync_order_process_job,
      { orderId: order.id },
    );
    this.logService.info(
      `Message sent to SQS for order with ID: ${order.id}`,
      ErpOrdersService.name,
      new Date().toISOString(),
    );
  }

  /**
   * Removes known validation keys from statusDetail for a specific order
   */
  private async clearValidationMessages(orderId: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `
        UPDATE channel_order
        SET statusDetail = JSON_REMOVE(
          statusDetail,
          '$.${StatusDetailKey.missing_sku}',
          '$.${StatusDetailKey.invalid_recipient}',
          '$.${StatusDetailKey.invalid_recipient_address}',
          '$.${StatusDetailKey.erp_item_inventory_message}'
        )
        WHERE id = ?
        `,
        orderId,
      );
    } catch (error) {
      this.logService.warn(
        'Failed to clear validation messages for order',
        ErpOrdersService.name,
        { orderId, error: error?.message },
      );
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async getNewStatusDetail(
    order: ChannelOrder,
    newMessage: Record<string, string>,
  ): Promise<Record<string, string>> {
    let updateMessage = {};
    if (order?.statusDetail) {
      try {
        updateMessage = order.statusDetail;
      } catch (e) {
        this.logService.error(
          'Error parsing statusDetail',
          ErpOrdersService.name,
          e,
        );
      }
    }
    return { ...updateMessage, ...newMessage };
  }

  async propagateErrorMessage(
    order: ChannelOrder,
    message: any,
  ): Promise<void> {
    let newMessage: Record<string, string> = {
      [message.userDetail?.type]: message.userDetail?.message,
    };

    const statusDetail = await this.getNewStatusDetail(order, newMessage);
    await this.channelOrderRepoService.update({
      where: { id: order.id },
      data: { statusDetail, status: OrderStatus.WARNING },
    });

    await this.processHistoryService.setOrderProcessHistory({
      id: order.id,
      userMessage: message.userDetail?.message,
      technicalMessage: message.technicalDetail,
    });
  }

  async propagateMultipleErrors(
    order: ChannelOrder,
    errors: Array<{
      type: string;
      userMessage: string;
      technicalMessage: string;
    }>,
  ): Promise<void> {
    // First, clear previous validation messages
    await this.clearValidationMessages(order.id);

    // Create new status detail with only current validation errors
    const updatedStatusDetail: Record<string, string> = {};

    errors.forEach((error) => {
      updatedStatusDetail[error.type] = error.userMessage;
    });

    await this.channelOrderRepoService.update({
      where: { id: order.id },
      data: { statusDetail: updatedStatusDetail, status: OrderStatus.WARNING },
    });

    // Add process history for all errors at once
    const processHistoryData = errors.map((error) => ({
      id: order.id,
      userMessage: error.userMessage,
      technicalMessage: error.technicalMessage,
    }));

    await this.processHistoryService.setMultipleOrderProcessHistory(
      processHistoryData,
    );
  }

  async checkingGuidesAndUpdatingDeliveryStatus(
    //orderNumberErp: string[],
    orderData: Array<OrderData>,
    apiRestErpToken: string,
  ): Promise<Record<DeliveryStatusKey, Array<OrderData>>> {
    try {
      const data = JSON.stringify({
        tipo_consulta: 'ORDCO',
        folios: orderData.map((order) => order.orderNumberErp),
      });

      const config = {
        headers: {
          Authorization: apiRestErpToken,
          'Content-Type': 'application/json',
        },
      };
      this.logService.info(
        'Checking guides and updating delivery status',
        ErpOrdersService.name,
        { data, config, apiRestErpUrl: this.apiRestErpUrl },
      );

      const response = await axios.post<ResponseOrders>(
        `${this.apiRestErpUrl}/rest/next/core/shipments/deliveries/details`,
        data,
        config,
      );

      this.logService.info(
        'Response from checking guides and updating delivery status',
        ErpOrdersService.name,
        response.data,
      );

      const shipmentsErpDetail = response?.data?.pedidos?.reduce(
        (acc, order) => {
          // Buscar la información completa del pedido en orderData
          const orderInfo = orderData.find(
            (od) => od.orderNumberErp === order.numero_orden,
          );

          if (orderInfo) {
            acc[order.clave_estado_embarque] = [
              ...(acc[order.clave_estado_embarque] || []),
              {
                orderNumberErp: order.numero_orden,
                partnerId: orderInfo.partnerId,
                ecommerceOrderId: orderInfo.ecommerceOrderId,
                shipmentOrigin: orderInfo.shipmentOrigin,
                ecommerceType: orderInfo.ecommerceType,
                delivery: order.entregas[0], // Agregar el primer elemento de entregas
                statusOrder: orderInfo.statusOrder,
              },
            ];
          }
          return acc;
        },
        {},
      ) as Record<DeliveryStatusKey, Array<OrderData>>;

      // Invocar downloadShipmentErp para procesar los envíos
      await this.erpShipmentService.downloadShipmentErp(
        shipmentsErpDetail,
        apiRestErpToken,
      );

      return shipmentsErpDetail;
    } catch (error) {
      this.logService.error(
        'Error in checkingGuidesAndUpdatingDeliveryStatus',
        ErpOrdersService.name,
        error.response?.data,
      );

      return {} as Record<DeliveryStatusKey, Array<OrderData>>;
    }
  }

  /**
   * Updates the status of multiple orders in the database with a single SQL query.
   *
   * @param orderIds - Array of order IDs to update
   * @param status - New status for the orders
   * @returns Number of updated orders
   */
  async updateOrdersStatus(
    status: DeliveryStatusKey,
    ordersToUpdate: Array<{
      orderNumberErp: string;
      partnerId: string;
      ecommerceOrderId: string;
      shipmentOrigin: ShipmentOrigin;
    }>,
    yujuToken: string,
  ): Promise<number> {
    if (!ordersToUpdate.length) return 0;

    let currentStatus: OrderStatus = OrderStatus.IN_PROCESS;

    if (status === DeliveryStatusKey.IN_DISTRIBUTION) {
      currentStatus = OrderStatus.PENDING_SHIPPING;
    } else if (status === DeliveryStatusKey.IN_TRANSIT) {
      currentStatus = OrderStatus.IN_TRANSIT;
    } else if (status === DeliveryStatusKey.CONFIRMED) {
      currentStatus = OrderStatus.DELIVERED;
    } else if (
      [
        DeliveryStatusKey.REJECTED,
        DeliveryStatusKey.CANCELED,
        DeliveryStatusKey.CANCELED_BY_CREDIT,
      ].includes(status)
    ) {
      currentStatus = OrderStatus.CANCELED;
    }

    // TODO: Solo si el origen es Next, se obtiene la guia y se guarda en el s3
    if (
      currentStatus === OrderStatus.IN_TRANSIT ||
      currentStatus === OrderStatus.DELIVERED
    ) {
      //await this.getShipmentData(orderIds, token, yujuToken);
      // Note: Yuju status update will be handled separately with order data
      for (const order of ordersToUpdate) {
        if (order.shipmentOrigin === ShipmentOrigin.NEXT && yujuToken) {
          await this.yujuService.sendYujuStatusUpdate({
            yujuToken: yujuToken,
            yujuOrderId: order.ecommerceOrderId,
            yujuChannelId: Number(order.partnerId),
            status: currentStatus as OrderStatus,
          });
        }
      }
      const orderNumberErpIdsString = ordersToUpdate
        .map((order) => `'${order.orderNumberErp}'`)
        .join(', ');
      const query = `
        UPDATE channel_order
        SET 
          status = '${currentStatus}',
          updatedAt = NOW(),
          updatedBy = 'SYSTEM'
        WHERE orderNumberErp IN (${orderNumberErpIdsString}) AND status != '${currentStatus}';
      `;

      try {
        const result = await this.prisma.$executeRawUnsafe(query);
        this.logService.info(
          `Orders updated successfully`,
          ErpOrdersService.name,
          {
            count: result,
            status,
            currentStatus,
            orderNumberErpIdsString,
            query,
          },
        );
        return result;
      } catch (error) {
        this.logService.error(
          'Error updating orders status',
          ErpOrdersService.name,
          error,
        );
        throw new CustomException(
          ErrorCodes.DATABASE_ERROR,
          'Error updating orders status',
        );
      }
    } else {
      this.logService.warn(
        'Orders status is not in transit or delivered, skipping status update',
        ErpOrdersService.name,
        { status, ordersToUpdate },
      );
      return 0;
    }
  }

  /**
   * @deprecated This method is deprecated and will be removed in a future version.
   * When the guide comes from Next, here it is obtained and saved in the s3
   * @param orderIds - Array of order IDs
   * @param token - Authentication token
   */
  async getShipmentData(
    orderIds: string[],
    token: string,
    yujuToken: string,
  ): Promise<void> {
    try {
      this.logService.info('Getting shipment data', ErpOrdersService.name, {
        orderIds,
        token,
      });
      const orders = await this.channelOrderRepoService.findMany({
        where: {
          orderNumberErp: { in: orderIds },
          shipmentOrigin: ShipmentOrigin.NEXT,
        },
      });

      const orderNext = orders.map((order) => ({
        orderId: order.id,
        channelId: order.channelId,
        orderNumberErp: order.orderNumberErp,
        shipmentDetail: order.shipmentDetail,
        guideTrackingDetail: order.guideTrackingDetail,
        status: order.status,
      }));
      for (const order of orderNext) {
        const data = JSON.stringify({
          tipo_consulta: 'ORDCO',
          folios: [order.orderNumberErp],
        });
        const response = await axios.post<ResponseOrders>(
          `${this.apiRestErpUrl}/rest/next/core/shipments/deliveries/details`,
          data,
          {
            headers: { Authorization: token },
          },
        );
        const deliveryData = response.data.pedidos[0].entregas[0];
        const { id_entrega } = deliveryData;
        this.logService.info('Getting shipment data', ErpOrdersService.name, {
          deliveryData,
        });
        const responseDelivery = await axios.get(
          `${this.apiRestErpUrl}/rest/next/third-party/deliveries/folio/${id_entrega}`,
          {
            headers: { Authorization: token },
          },
        );
        const shipmentData = responseDelivery.data;
        this.logService.info('Getting shipment data', ErpOrdersService.name, {
          shipmentData,
        });

        // Validate shipmentData before destructuring
        if (
          !shipmentData ||
          !Array.isArray(shipmentData) ||
          shipmentData.length === 0
        ) {
          this.logService.warn(
            'No shipment data available for delivery',
            ErpOrdersService.name,
            {
              orderId: order.orderId,
              orderNumberErp: order.orderNumberErp,
              id_entrega,
              shipmentData,
            },
          );
          continue; // Skip this order and continue with the next one
        }

        const { courier, tracking_number, file_type, file } = shipmentData[0];
        order.shipmentDetail['courier'] = courier;
        order.shipmentDetail['tracking_number'] = tracking_number;
        const pdfBuffer =
          file_type === 'ZPL'
            ? await this.zplService.convertZplToPdf(file)
            : file;
        // const s3Key = `shipping-labels/NextCloud/${trackingNumber}.pdf`;
        const s3Key = getGuideS3Key(tracking_number, 'NextCloud');

        const s3Url = await this.s3Service.uploadFile(
          this.configService.get<string>('BUCKET_INVENTORY_FILES'),
          s3Key,
          pdfBuffer,
          'application/pdf',
        );

        const downloadDate = new Date().toISOString();
        order.shipmentDetail['guide_fetched_at'] = downloadDate;
        order.shipmentDetail['guide_s3_url'] = location;
        order.shipmentDetail['guide_s3_key'] = s3Key;
        order.guideTrackingDetail['downloadDate'] = downloadDate;
        order.guideTrackingDetail['lastDownloadAttemptDate'] = null;
        order.guideTrackingDetail['errorMessage'] = null;
        order.shipmentDetail['label_url'] = s3Url;

        this.logService.info('Getting shipment data', ErpOrdersService.name, {
          shipmentDetail: order.shipmentDetail,
        });
        await this.channelOrderRepoService.update({
          where: { id: order.orderId },
          data: {
            shipmentDetail: order.shipmentDetail,
            shipmentGuideS3Key: s3Key,
            guideTrackingDetail: order.guideTrackingDetail,
          },
        });

        // Solo enviar actualización a Yuju si existe el token
        if (yujuToken) {
          await this.yujuService.sendYujuStatusUpdate({
            yujuToken: yujuToken,
            yujuOrderId: order.orderNumberErp,
            yujuChannelId: Number(order.channelId),
            status: order.status as OrderStatus,
          });
        }
      }
    } catch (error) {
      this.logService.error(
        'Error getting shipment data',
        ErpOrdersService.name,
        error,
      );
    }
  }

  private async handlerSaveGuideError(order: ChannelOrder, error) {
    order.guideTrackingDetail['downloadDate'] = new Date().toISOString();
    order.guideTrackingDetail['errorMessage'] = error.message;

    await this.channelOrderRepoService.update({
      where: { id: order.id },
      data: {
        guideTrackingDetail: order.guideTrackingDetail,
      },
    });

    this.logService.error(
      'Error getting shipment data',
      ErpOrdersService.name,
      {
        orderId: order.id,
        error: error.message,
        stack: error.stack,
      },
    );
    throw error;
  }

  /**
   * Cancels an order in Next ERP by calling the stop-sending endpoint.
   *
   * @param folioNext - The order folio in Next ERP
   * @param reasonId - The cancellation reason ID
   * @param apiRestErpToken - Authentication token for Next ERP
   * @returns Object indicating success or failure with optional error message
   */
  async cancelOrderInErp(
    folioNext: string,
    reasonId: number,
    apiRestErpToken: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.apiRestErpUrl}/rest/next/core/sales/stop-sending`;
      const body = {
        order: folioNext,
        reason: reasonId,
      };

      this.logService.info(
        'Sending cancellation request to Next ERP',
        ErpOrdersService.name,
        { folioNext, reasonId, url },
      );

      const response = await axios.post(url, body, {
        headers: {
          Authorization: apiRestErpToken,
          'Content-Type': 'application/json',
        },
      });

      // Check if response indicates an error
      if (response.data?.error) {
        const errorMessage =
          response.data?.msg || response.data?.message || 'Unknown error';
        this.logService.warn(
          'Next ERP returned error for cancellation',
          ErpOrdersService.name,
          { folioNext, response: response.data },
        );
        return { success: false, error: errorMessage };
      }

      this.logService.info(
        'Order successfully cancelled in Next ERP',
        ErpOrdersService.name,
        { folioNext, response: response.data },
      );

      return { success: true };
    } catch (error) {
      const errorMessage =
        error.response?.data?.msg ||
        error.response?.data?.message ||
        error.message ||
        'Error connecting to Next ERP';

      this.logService.error(
        'Error cancelling order in Next ERP',
        ErpOrdersService.name,
        {
          folioNext,
          reasonId,
          error: errorMessage,
          responseData: error.response?.data,
        },
      );

      return { success: false, error: errorMessage };
    }
  }
}
