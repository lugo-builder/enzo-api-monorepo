import { Injectable } from '@nestjs/common';

import {
  AuditLogRepoService,
  ChannelOrderItemRepoService,
  DatabaseService,
} from '@app/database';
import { LogService } from '@app/log';

/** Local enums when Prisma schema does not include audit/order enums */
const AuditAction = {
  PRODUCT_FFTYPE_CHANGED: 'PRODUCT_FFTYPE_CHANGED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_SUBSTATUS_CHANGED: 'ORDER_SUBSTATUS_CHANGED',
  ORDER_GUIDE_UPDATED: 'ORDER_GUIDE_UPDATED',
  ORDER_BUYER_UPDATED: 'ORDER_BUYER_UPDATED',
  ORDER_ADDRESS_UPDATED: 'ORDER_ADDRESS_UPDATED',
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CANCELED: 'ORDER_CANCELED',
} as const;
const AuditOrigin = { USER: 'USER', SYSTEM: 'SYSTEM' } as const;
type AuditOriginType = (typeof AuditOrigin)[keyof typeof AuditOrigin];
type FfTypeItem = string;
const OrderStatus = { CANCELED: 'CANCELED' } as const;
type OrderStatusType = string;

@Injectable()
export class AuditLogService {
  constructor(
    private readonly auditLogRepoService: AuditLogRepoService,
    private readonly channelOrderItemRepoService: ChannelOrderItemRepoService,
    private readonly prisma: DatabaseService,
    private readonly logService: LogService,
  ) {}

  /**
   * Registra el cambio de ffTypeItem en un producto
   * Si el producto tiene órdenes relacionadas, también registra el evento en cada orden
   */
  async logProductFfTypeChange(
    productId: string,
    previousValue: FfTypeItem,
    newValue: FfTypeItem,
    origin: AuditOriginType,
    userId?: string,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging product ffType change',
        AuditLogService.name,
        {
          productId,
          previousValue,
          newValue,
          origin,
          userId,
        },
      );

      // Registrar en bitácora del producto
      await this.auditLogRepoService.create({
        data: {
          entityType: 'product',
          entityId: productId,
          action: AuditAction.PRODUCT_FFTYPE_CHANGED,
          previousValue: previousValue as any,
          newValue: newValue as any,
          origin,
          userId: origin === AuditOrigin.USER ? userId : null,
        },
      });

      // Buscar órdenes relacionadas por SKU
      await this.logFfTypeChangeInRelatedOrders(
        productId,
        previousValue,
        newValue,
        origin,
        userId,
      );
    } catch (error) {
      this.logService.error(
        'Error logging product ffType change',
        AuditLogService.name,
        {
          productId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Busca órdenes relacionadas al producto por SKU y registra el evento
   */
  private async logFfTypeChangeInRelatedOrders(
    productId: string,
    previousValue: FfTypeItem,
    newValue: FfTypeItem,
    origin: AuditOriginType,
    userId?: string,
  ): Promise<void> {
    try {
      // Obtener el producto para conocer sus SKUs
      const product = await this.prisma.catalogItem.findUnique({
        where: { id: productId },
        select: {
          skuChannel: true,
          skuErp: true,
        },
      });

      if (!product) {
        return;
      }

      // Buscar items de órdenes que coincidan con skuChannel o skuErp
      const orderItems = await this.channelOrderItemRepoService.findMany({
        where: {
          OR: [
            { sku: product.skuChannel },
            ...(product.skuErp ? [{ sku: product.skuErp }] : []),
          ],
          deletedAt: null,
        },
        select: {
          orderId: true,
        },
        distinct: ['orderId'],
      });

      if (!orderItems || orderItems.length === 0) {
        return;
      }

      // Obtener IDs únicos de órdenes
      const orderIds = [
        ...new Set(orderItems.map((item) => item.orderId).filter(Boolean)),
      ] as string[];

      if (orderIds.length === 0) {
        return;
      }

      // Registrar evento en cada orden relacionada
      const auditLogs = orderIds.map((orderId) => ({
        entityType: 'order',
        entityId: orderId,
        action: AuditAction.PRODUCT_FFTYPE_CHANGED,
        previousValue: {
          productId,
          ffTypeItem: previousValue,
        } as any,
        newValue: {
          productId,
          ffTypeItem: newValue,
        } as any,
        origin,
        userId: origin === AuditOrigin.USER ? userId : null,
        metadata: {
          relatedProductId: productId,
        } as any,
      }));

      await this.auditLogRepoService.createMany({
        data: auditLogs,
      });

      this.logService.info(
        'Logged ffType change in related orders',
        AuditLogService.name,
        {
          productId,
          orderIds,
          count: orderIds.length,
        },
      );
    } catch (error) {
      this.logService.error(
        'Error logging ffType change in related orders',
        AuditLogService.name,
        {
          productId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra la actualización de un producto (cualquier campo)
   */
  async logProductUpdate(
    productId: string,
    changes: Record<string, any>,
    origin: AuditOriginType,
    userId?: string,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging product update',
        AuditLogService.name,
        {
          productId,
          changes,
          origin,
          userId,
        },
      );

      // Separar previousValue y newValue de los cambios
      const previousValue: Record<string, any> = {};
      const newValue: Record<string, any> = {};

      for (const [field, change] of Object.entries(changes)) {
        previousValue[field] = change.from;
        newValue[field] = change.to;
      }

      await this.auditLogRepoService.create({
        data: {
          entityType: 'product',
          entityId: productId,
          action: AuditAction.PRODUCT_UPDATED,
          previousValue: previousValue as any,
          newValue: newValue as any,
          origin,
          userId: origin === AuditOrigin.USER ? userId : null,
          metadata: {
            fieldsChanged: Object.keys(changes),
          } as any,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging product update',
        AuditLogService.name,
        {
          productId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra el cambio de estado de una orden
   */
  async logOrderStatusChange(
    orderId: string,
    previousStatus: OrderStatusType | null,
    newStatus: OrderStatusType,
    origin: AuditOriginType,
    userId?: string,
  ): Promise<void> {
    try {
      this.logService.info(
        'Logging order status change',
        AuditLogService.name,
        {
          orderId,
          previousStatus,
          newStatus,
          origin,
          userId,
        },
      );

      await this.auditLogRepoService.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          action: AuditAction.ORDER_STATUS_CHANGED,
          previousValue: previousStatus as any,
          newValue: newStatus as any,
          origin,
          userId: origin === AuditOrigin.USER ? userId : null,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging order status change',
        AuditLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra el cambio de subestatus/warnings en una orden
   */
  async logOrderSubstatusChange(
    orderId: string,
    previousSubstatus: Record<string, any> | null,
    newSubstatus: Record<string, any>,
    origin: AuditOriginType,
    userId?: string,
  ): Promise<void> {
    try {
      // Comparar para detectar cambios específicos
      const changes = this.detectSubstatusChanges(
        previousSubstatus || {},
        newSubstatus,
      );

      if (changes.length === 0) {
        return; // No hay cambios significativos
      }

      this.logService.info(
        'Logging order substatus change',
        AuditLogService.name,
        {
          orderId,
          changes,
          origin,
          userId,
        },
      );

      // Registrar cada cambio detectado
      for (const change of changes) {
        await this.auditLogRepoService.create({
          data: {
            entityType: 'order',
            entityId: orderId,
            action: AuditAction.ORDER_SUBSTATUS_CHANGED,
            previousValue: change.previousValue as any,
            newValue: change.newValue as any,
            origin,
            userId: origin === AuditOrigin.USER ? userId : null,
            metadata: {
              key: change.key,
            } as any,
          },
        });
      }
    } catch (error) {
      this.logService.error(
        'Error logging order substatus change',
        AuditLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Detecta cambios específicos en el statusDetail
   */
  private detectSubstatusChanges(
    previous: Record<string, any>,
    current: Record<string, any>,
  ): Array<{ key: string; previousValue: any; newValue: any }> {
    const changes: Array<{ key: string; previousValue: any; newValue: any }> =
      [];
    const allKeys = new Set([
      ...Object.keys(previous),
      ...Object.keys(current),
    ]);

    for (const key of allKeys) {
      const prevValue = previous[key];
      const currValue = current[key];

      // Si la clave existe en ambos y son diferentes, o si se agregó/eliminó
      if (prevValue !== currValue) {
        changes.push({
          key,
          previousValue: prevValue ?? null,
          newValue: currValue ?? null,
        });
      }
    }

    return changes;
  }

  /**
   * Registra la actualización de guía de envío
   */
  async logOrderGuideUpdate(
    orderId: string,
    guideData: any,
    origin: AuditOriginType,
    userId?: string,
  ): Promise<void> {
    try {
      this.logService.info('Logging order guide update', AuditLogService.name, {
        orderId,
        origin,
        userId,
      });

      await this.auditLogRepoService.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          action: AuditAction.ORDER_GUIDE_UPDATED,
          previousValue: null,
          newValue: guideData as any,
          origin,
          userId: origin === AuditOrigin.USER ? userId : null,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging order guide update',
        AuditLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra la actualización de datos del comprador
   */
  async logOrderBuyerUpdate(
    orderId: string,
    previousBuyer: any,
    newBuyer: any,
    origin: AuditOriginType,
    userId?: string,
  ): Promise<void> {
    try {
      // Solo registrar si hay cambios reales
      if (JSON.stringify(previousBuyer) === JSON.stringify(newBuyer)) {
        return;
      }

      this.logService.info('Logging order buyer update', AuditLogService.name, {
        orderId,
        origin,
        userId,
      });

      await this.auditLogRepoService.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          action: AuditAction.ORDER_BUYER_UPDATED,
          previousValue: previousBuyer as any,
          newValue: newBuyer as any,
          origin,
          userId: origin === AuditOrigin.USER ? userId : null,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging order buyer update',
        AuditLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra la actualización de dirección de envío
   */
  async logOrderAddressUpdate(
    orderId: string,
    previousAddress: any,
    newAddress: any,
    origin: AuditOriginType,
    userId?: string,
  ): Promise<void> {
    try {
      // Solo registrar si hay cambios reales
      if (JSON.stringify(previousAddress) === JSON.stringify(newAddress)) {
        return;
      }

      this.logService.info(
        'Logging order address update',
        AuditLogService.name,
        {
          orderId,
          origin,
          userId,
        },
      );

      await this.auditLogRepoService.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          action: AuditAction.ORDER_ADDRESS_UPDATED,
          previousValue: previousAddress as any,
          newValue: newAddress as any,
          origin,
          userId: origin === AuditOrigin.USER ? userId : null,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging order address update',
        AuditLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra la creación de una orden
   * Este es el primer evento que se registra cuando se crea una orden
   */
  async logOrderCreation(
    orderId: string,
    orderData: {
      ecommerceOrderId?: string;
      status?: OrderStatusType;
      total?: number;
      channelId?: string;
      [key: string]: any;
    },
    origin: AuditOriginType = AuditOrigin.SYSTEM,
    userId?: string,
  ): Promise<void> {
    try {
      this.logService.info('Logging order creation', AuditLogService.name, {
        orderId,
        origin,
        userId,
      });

      await this.auditLogRepoService.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          action: AuditAction.ORDER_CREATED,
          previousValue: null,
          newValue: 'Orden creada' as any,
          origin,
          userId: origin === AuditOrigin.USER ? userId : null,
          // Guardar datos adicionales en metadata para referencia si se necesita
          metadata: orderData as any,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging order creation',
        AuditLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Registra la cancelación exitosa de una orden
   * Solo llamar cuando la orden efectivamente cambió a CANCELED
   */
  async logOrderCancellation(
    orderId: string,
    previousStatus: OrderStatusType | null,
    cancellationReason: string,
    origin: AuditOriginType,
    userId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      this.logService.info('Logging order cancellation', AuditLogService.name, {
        orderId,
        previousStatus,
        cancellationReason,
        origin,
      });

      await this.auditLogRepoService.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          action: AuditAction.ORDER_CANCELED,
          previousValue: { status: previousStatus } as any,
          newValue: {
            status: OrderStatus.CANCELED,
            reason: cancellationReason,
          } as any,
          origin,
          userId: origin === AuditOrigin.USER ? userId : null,
          metadata: metadata as any,
        },
      });
    } catch (error) {
      this.logService.error(
        'Error logging order cancellation',
        AuditLogService.name,
        {
          orderId,
          error: error?.message || error,
        },
      );
      // No lanzar error para no interrumpir el flujo principal
    }
  }
}
