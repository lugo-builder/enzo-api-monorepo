import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { DatabaseService } from '@app/database';
import { LogService } from '@app/log';

/** Local enums when Prisma schema does not include order/catalog enums */
const CatalogItemStatus = {} as Record<string, string>;
const ChannelOrderExtractionStatus = { PENDING: 'PENDING', ERROR: 'ERROR', PROCESSED: 'PROCESSED' } as const;
const OrderStatus = {} as Record<string, string>;
import { StatusDetailKey } from '../consts/status-detail-key';

@Injectable()
export class OrderValidationService {
  private readonly logService: LogService;

  constructor(
    private readonly prisma: DatabaseService,
    private readonly moduleRef: ModuleRef,
  ) {
    this.logService = this.moduleRef.get(LogService, { strict: false });
  }

  /**
   * Validates and associates ERP SKUs to order items for a specific user
   * @param userId - The user ID to process orders for
   */
  public async validateAndAssociateErpSkusToTheOrderItems(
    userId: string,
  ): Promise<void> {
    this.logService.info(
      'Validating and associating ERP SKUs to the order items',
      OrderValidationService.name,
      { userId },
    );

    try {
      // Step 1: Update order items with ERP SKUs from catalog
      await this.updateOrderItemsWithErpSkus(userId);

      // Step 2: Update order statuses based on SKU availability
      await this.updateOrderStatuses(userId);

      // Step 3: Create extraction records for channels with integrators
      await this.createExtractionRecordsForUserChannels(userId);

      // Step 4: Update extraction records
      await this.updateExtractionRecords(userId);

      // Step 5: Process channels and send notifications
      await this.processChannelsAndNotifications(userId);
    } catch (error) {
      this.logService.error(
        'Error in validateAndAssociateErpSkusToTheOrderItems',
        OrderValidationService.name,
        error,
      );
      throw error;
    }
  }

  /**
   * Validates and associates ERP SKUs to order items for a specific channel
   * @param channelId - The channel ID to process orders for
   */
  public async validateAndAssociateErpSkusToTheOrderItemsByChannelId(
    channelId: string,
  ): Promise<void> {
    this.logService.info(
      'Validating and associating ERP SKUs to the order items by channel',
      OrderValidationService.name,
      { channelId },
    );

    try {
      // Step 1: Update order items with ERP SKUs from catalog
      await this.updateOrderItemsWithErpSkusByChannel(channelId);

      // Step 2: Update order statuses based on SKU availability
      await this.updateOrderStatusesByChannel(channelId);

      // Step 3: Update extraction records
      await this.updateExtractionRecordsByChannel(channelId);

      // Note: Sending orders to ERP should be handled by the calling service
      // to avoid circular dependencies
    } catch (error) {
      this.logService.error(
        'Error in validateAndAssociateErpSkusToTheOrderItemsByChannelId',
        OrderValidationService.name,
        error,
      );
      throw error;
    }
  }

  /**
   * Updates order items with ERP SKUs from catalog items
   */
  private async updateOrderItemsWithErpSkus(userId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order_item coi
      JOIN catalog_item ci ON ci.productId = coi.ecommerceItemId
      JOIN channel_order co ON co.id = coi.orderId
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET coi.sku = ci.skuErp
      WHERE ci.skuErp IS NOT NULL
        AND ci.status IN ('${CatalogItemStatus.SUCCESS}', '${CatalogItemStatus.PENDING_CREATION_ERP}')
        AND c.userId = ?
        AND (ci.channelId IS NULL OR ci.channelId = co.channelId)
      `,
      userId,
    );
  }

  /**
   * Updates order items with ERP SKUs from catalog items for a specific channel
   */
  private async updateOrderItemsWithErpSkusByChannel(
    channelId: string,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order_item coi
      JOIN catalog_item ci ON ci.productId = coi.ecommerceItemId
      JOIN channel_order co ON co.id = coi.orderId
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET coi.sku = ci.skuErp
      WHERE ci.skuErp IS NOT NULL
      AND ci.status IN ('${CatalogItemStatus.SUCCESS}', '${CatalogItemStatus.PENDING_CREATION_ERP}')
      AND co.channelId = ?
      AND (ci.channelId IS NULL OR ci.channelId = co.channelId)
    `,
      channelId,
    );
  }

  /**
   * Updates order statuses based on whether items have SKUs assigned
   */
  public async updateOrderStatuses(userId: string): Promise<void> {
    // 1) Add or refresh missing_sku message when any item lacks ERP SKU
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET 
        co.statusDetail = JSON_SET(
          IF(
            JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_sku}'),
            co.statusDetail,
            JSON_INSERT(co.statusDetail, '$.${StatusDetailKey.missing_sku}', 'Se encontraron productos sin el SKU del ERP')
          ), '$.${StatusDetailKey.missing_sku}', 'Se encontraron productos sin el SKU del ERP'
        )
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND EXISTS (
            SELECT 1 FROM channel_order_item coi 
            WHERE coi.orderId = co.id AND coi.sku IS NULL
        )
      `,
      userId,
    );

    // 2) Remove missing_sku message when all items already have ERP SKU
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_REMOVE(co.statusDetail, '$.${StatusDetailKey.missing_sku}')
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND NOT EXISTS (
            SELECT 1 FROM channel_order_item coi 
            WHERE coi.orderId = co.id AND coi.sku IS NULL
        )
      `,
      userId,
    );

    // 3) Add or refresh invalid_recipient when recipient JSON lacks required fields
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_SET(
          IF(
            JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}'),
            co.statusDetail,
            JSON_INSERT(co.statusDetail, '$.${StatusDetailKey.invalid_recipient}', 'Información incompleta del destinatario')
          ), '$.${StatusDetailKey.invalid_recipient}', 'Información incompleta del destinatario'
        )
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.name')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.name')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.phone')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.phone')) = ''
        )
      `,
      userId,
    );

    // 4) Remove invalid_recipient when recipient JSON has all required fields
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_REMOVE(co.statusDetail, '$.${StatusDetailKey.invalid_recipient}')
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.name')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.name')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.phone')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.phone')) <> ''
        )
      `,
      userId,
    );

    // 5) Add or refresh invalid_recipient_address when address JSON lacks required fields
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_SET(
          IF(
            JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}_address'),
            co.statusDetail,
            JSON_INSERT(co.statusDetail, '$.${StatusDetailKey.invalid_recipient}_address', 'Información incompleta de la dirección del destinatario')
          ), '$.${StatusDetailKey.invalid_recipient}_address', 'Información incompleta de la dirección del destinatario'
        )
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.street')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.street')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.number')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.number')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.state')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.state')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.zipCode')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.zipCode')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.neighborhood')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.neighborhood')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.municipality')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.municipality')) = ''
        )
      `,
      userId,
    );

    // 6) Remove invalid_recipient_address when address JSON has all required fields
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_REMOVE(co.statusDetail, '$.${StatusDetailKey.invalid_recipient}_address')
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.street')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.street')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.number')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.number')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.state')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.state')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.zipCode')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.zipCode')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.neighborhood')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.neighborhood')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.municipality')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.municipality')) <> ''
        )
      `,
      userId,
    );

    // 7) Add or refresh missing_product_id when any item lacks ecommerceItemId
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET 
        co.statusDetail = JSON_SET(
          IF(
            JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_product_id}'),
            co.statusDetail,
            JSON_INSERT(co.statusDetail, '$.${StatusDetailKey.missing_product_id}', 'Se encontraron productos sin identificador del integrador')
          ), '$.${StatusDetailKey.missing_product_id}', 'Se encontraron productos sin identificador del integrador'
        )
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND EXISTS (
            SELECT 1 FROM channel_order_item coi 
            WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL
        )
      `,
      userId,
    );

    // 8) Remove missing_product_id when all items already have ecommerceItemId
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_REMOVE(co.statusDetail, '$.${StatusDetailKey.missing_product_id}')
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND NOT EXISTS (
            SELECT 1 FROM channel_order_item coi 
            WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL
        )
      `,
      userId,
    );

    // 9) Finally, align status with messages: WARNING if any known message exists or there are items without SKU; otherwise PENDING
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.status = CASE
          WHEN (
            EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.sku IS NULL)
            OR EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL)
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}_address')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_product_id}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.erp_item_inventory_message}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.yuju_guide_fetch_error}')
          ) THEN '${OrderStatus.WARNING}'
          ELSE '${OrderStatus.PENDING}'
        END,
        co.failedAttempts = CASE
          WHEN (
            EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.sku IS NULL)
            OR EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL)
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}_address')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_product_id}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.erp_item_inventory_message}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.yuju_guide_fetch_error}')
          ) THEN co.failedAttempts
          ELSE 0
        END,
        co.retryTime = CASE
          WHEN (
            EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.sku IS NULL)
            OR EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL)
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}_address')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_product_id}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.erp_item_inventory_message}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.yuju_guide_fetch_error}')
          ) THEN co.retryTime
          ELSE NULL
        END
      WHERE c.userId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
      `,
      userId,
    );
  }

  /**
   * Updates order statuses based on whether items have SKUs assigned for a specific channel
   */
  private async updateOrderStatusesByChannel(channelId: string): Promise<void> {
    // 1) Add or refresh missing_sku message when any item lacks ERP SKU
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET 
        co.statusDetail = JSON_SET(
          IF(
            JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_sku}'),
            co.statusDetail,
            JSON_INSERT(co.statusDetail, '$.${StatusDetailKey.missing_sku}', 'Se encontraron productos sin el SKU del ERP')
          ), '$.${StatusDetailKey.missing_sku}', 'Se encontraron productos sin el SKU del ERP'
        )
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND EXISTS (
            SELECT 1 FROM channel_order_item coi 
            WHERE coi.orderId = co.id AND coi.sku IS NULL
        )
    `,
      channelId,
    );

    // 2) Remove missing_sku message when all items already have ERP SKU
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_REMOVE(co.statusDetail, '$.${StatusDetailKey.missing_sku}')
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND NOT EXISTS (
            SELECT 1 FROM channel_order_item coi 
            WHERE coi.orderId = co.id AND coi.sku IS NULL
        )
    `,
      channelId,
    );

    // 3) Add or refresh invalid_recipient when recipient JSON lacks required fields
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_SET(
          IF(
            JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}'),
            co.statusDetail,
            JSON_INSERT(co.statusDetail, '$.${StatusDetailKey.invalid_recipient}', 'Información incompleta del destinatario')
          ), '$.${StatusDetailKey.invalid_recipient}', 'Información incompleta del destinatario'
        )
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.name')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.name')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.phone')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.phone')) = ''
        )
    `,
      channelId,
    );

    // 4) Remove invalid_recipient when recipient JSON has all required fields
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_REMOVE(co.statusDetail, '$.${StatusDetailKey.invalid_recipient}')
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.name')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.name')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.phone')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipient, '$.phone')) <> ''
        )
    `,
      channelId,
    );

    // 5) Add or refresh invalid_recipient_address when address JSON lacks required fields
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_SET(
          IF(
            JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}_address'),
            co.statusDetail,
            JSON_INSERT(co.statusDetail, '$.${StatusDetailKey.invalid_recipient}_address', 'Información incompleta de la dirección del destinatario')
          ), '$.${StatusDetailKey.invalid_recipient}_address', 'Información incompleta de la dirección del destinatario'
        )
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.street')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.street')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.number')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.number')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.state')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.state')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.zipCode')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.zipCode')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.neighborhood')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.neighborhood')) = ''
          OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.municipality')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.municipality')) = ''
        )
    `,
      channelId,
    );

    // 6) Remove invalid_recipient_address when address JSON has all required fields
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_REMOVE(co.statusDetail, '$.${StatusDetailKey.invalid_recipient}_address')
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.street')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.street')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.number')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.number')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.state')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.state')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.zipCode')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.zipCode')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.neighborhood')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.neighborhood')) <> ''
          AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.municipality')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(co.recipientAddress, '$.municipality')) <> ''
        )
    `,
      channelId,
    );

    // 7) Add or refresh missing_product_id when any item lacks ecommerceItemId
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET 
        co.statusDetail = JSON_SET(
          IF(
            JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_product_id}'),
            co.statusDetail,
            JSON_INSERT(co.statusDetail, '$.${StatusDetailKey.missing_product_id}', 'Se encontraron productos sin identificador del integrador')
          ), '$.${StatusDetailKey.missing_product_id}', 'Se encontraron productos sin identificador del integrador'
        )
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND EXISTS (
            SELECT 1 FROM channel_order_item coi 
            WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL
        )
    `,
      channelId,
    );

    // 8) Remove missing_product_id when all items already have ecommerceItemId
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.statusDetail = JSON_REMOVE(co.statusDetail, '$.${StatusDetailKey.missing_product_id}')
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
        AND NOT EXISTS (
            SELECT 1 FROM channel_order_item coi 
            WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL
        )
    `,
      channelId,
    );

    // 9) Finally, align status with messages: WARNING if any known message exists or there are items without SKU; otherwise PENDING
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order co
      JOIN channel c ON c.id = co.channelId AND c.deletedAt IS NULL
      SET co.status = CASE
          WHEN (
            EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.sku IS NULL)
            OR EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL)
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}_address')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_product_id}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.erp_item_inventory_message}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.yuju_guide_fetch_error}')
          ) THEN '${OrderStatus.WARNING}'
          ELSE '${OrderStatus.PENDING}'
        END,
        co.failedAttempts = CASE
          WHEN (
            EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.sku IS NULL)
            OR EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL)
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}_address')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_product_id}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.erp_item_inventory_message}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.yuju_guide_fetch_error}')
          ) THEN co.failedAttempts
          ELSE 0
        END,
        co.retryTime = CASE
          WHEN (
            EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.sku IS NULL)
            OR EXISTS (SELECT 1 FROM channel_order_item coi WHERE coi.orderId = co.id AND coi.ecommerceItemId IS NULL)
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.invalid_recipient}_address')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.missing_product_id}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.erp_item_inventory_message}')
            OR JSON_CONTAINS_PATH(co.statusDetail, 'one', '$.${StatusDetailKey.yuju_guide_fetch_error}')
          ) THEN co.retryTime
          ELSE NULL
        END
      WHERE co.channelId = ?
        AND co.status IN ('${OrderStatus.IN_EVALUATION}', '${OrderStatus.WARNING}', '${OrderStatus.FAILED}', '${OrderStatus.PENDING}')
    `,
      channelId,
    );
  }

  /**
   * Updates extraction records based on SKU availability
   */
  private async updateExtractionRecords(userId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order_extraction coe
      JOIN channel c ON c.id = coe.channelId AND c.deletedAt IS NULL
      JOIN (
            SELECT coe_inner.channelId, MAX(coe_inner.createdAt) as maxCreatedAt
            FROM channel_order_extraction coe_inner
            JOIN channel c2 ON c2.id = coe_inner.channelId AND c2.deletedAt IS NULL
            WHERE c2.userId = ?
            GROUP BY coe_inner.channelId
        ) latest ON coe.channelId = latest.channelId AND coe.createdAt = latest.maxCreatedAt
      SET coe.status = IF(
          EXISTS (
              SELECT 1
              FROM channel_order co
              JOIN channel_order_item coi ON coi.orderId = co.id
              WHERE co.channelId = coe.channelId AND coi.sku IS NULL
          ), '${ChannelOrderExtractionStatus.ERROR}', '${ChannelOrderExtractionStatus.PROCESSED}'
      ),
      coe.errorDetails = IF(
          EXISTS (
              SELECT 1
              FROM channel_order co
              JOIN channel_order_item coi ON coi.orderId = co.id
              WHERE co.channelId = coe.channelId AND coi.sku IS NULL
          ), '{"message": "Se encontraron productos sin el SKU del ERP"}', NULL)
      `,
      userId,
    );
  }

  /**
   * Updates extraction records based on SKU availability for a specific channel
   */
  private async updateExtractionRecordsByChannel(
    channelId: string,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE channel_order_extraction coe
      JOIN channel c ON c.id = coe.channelId AND c.deletedAt IS NULL
      JOIN (
          SELECT id
          FROM channel_order_extraction
          WHERE channelId = ?
          ORDER BY createdAt DESC
          LIMIT 1
      ) latest ON coe.id = latest.id
      SET coe.status = IF(
          EXISTS (
              SELECT 1
              FROM channel_order co
              JOIN channel_order_item coi ON coi.orderId = co.id
              WHERE co.channelId = coe.channelId AND coi.sku IS NULL
          ), '${ChannelOrderExtractionStatus.ERROR}', '${ChannelOrderExtractionStatus.PROCESSED}'
      ),
      coe.errorDetails = IF(
          EXISTS (
              SELECT 1
              FROM channel_order co
              JOIN channel_order_item coi ON coi.orderId = co.id
              WHERE co.channelId = coe.channelId AND coi.sku IS NULL
          ), '{"message": "Se encontraron productos sin el SKU del ERP"}', NULL)
      WHERE coe.channelId = ?
      `,
      channelId,
      channelId,
    );
  }

  /**
   * Creates extraction records for user channels that have integrators
   * Optimized to ensure only one record per channel with integrator
   */
  private async createExtractionRecordsForUserChannels(
    userId: string,
  ): Promise<void> {
    try {
      // Use a single query to get channels with integrators that don't have extraction records
      const channelsToCreate = await (this.prisma as any).channel.findMany({
        where: {
          userId,
          isConnect: true,
          channelIntegratorId: {
            not: null,
          },
          deletedAt: null,
          // Only include channels that don't have any extraction records
          channelOrderExtraction: {
            none: {},
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (channelsToCreate.length === 0) {
        this.logService.info(
          'No channels with integrators found or all channels already have extraction records',
          OrderValidationService.name,
          { userId },
        );
        return;
      }

      // Create extraction records for channels without any records
      const data: { channelId: string; status: string }[] =
        channelsToCreate.map((channel) => ({
          channelId: channel.id,
          status: ChannelOrderExtractionStatus.PENDING,
          userId: channel.userId,
          orderTotal: 0,
          createdBy: channel.userId,
        }));

      await (this.prisma as any).channelOrderExtraction.createMany({
        data,
      });

      this.logService.info(
        'Extraction records created for user channels',
        OrderValidationService.name,
        {
          userId,
          channelsCreated: channelsToCreate.length,
        },
      );
    } catch (error) {
      this.logService.error(
        'Error creating extraction records for user channels',
        OrderValidationService.name,
        { userId, error },
      );
      throw error;
    }
  }

  /**
   * Processes channels and sends notifications for missing SKUs
   */
  private async processChannelsAndNotifications(userId: string): Promise<void> {
    const channels = await (this.prisma as any).channel.findMany({
      where: {
        userId,
        isConnect: true,
        isCredentials: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    for (const channel of channels) {
      this.logService.info(
        'Order items validated and associated to the catalog items',
        OrderValidationService.name,
        { channelId: channel.id },
      );

      // Send orders to ERP (if ErpOrdersService is available)
      // await this.sendOrdersToErp(channel.id); // Removed as per edit hint

      // Send email notification for missing SKUs
      await this.sendMissingSkuNotification(channel);
    }
  }

  /**
   * Sends email notification for items with missing SKUs
   */
  private async sendMissingSkuNotification(channel: {
    id: string;
    name: string;
  }): Promise<void> {
    const itemsMissingSku = await (this.prisma as any).channelOrderItem.findMany({
      where: {
        sku: null,
        order: {
          channelId: channel.id,
          status: OrderStatus.WARNING,
          channel: {
            deletedAt: null,
          },
        },
      },
      select: {
        ecommerceItemId: true,
        ecommerceItemSku: true,
        orderId: true,
        name: true,
      },
    });

    if (itemsMissingSku.length > 0) {
      // Get admin users
      const adminUsers = await this.prisma.user.findMany({
        select: {
          email: true,
        },
        where: { role: { name: 'Admin' }, status: 'ACTIVE' },
      });

      try {
        // Try to get EmailService if available
        const emailService = this.moduleRef.get('EmailService', {
          strict: false,
        });
        if (emailService) {
          await emailService.sendEmail(
            'warning-sku-template',
            {
              channelName: channel.name,
              totalItems: itemsMissingSku.length,
              items: itemsMissingSku,
            },
            adminUsers.map((user) => user.email),
            `⚠️ Productos sin asignación de SKU del ERP en canal ${channel.name}`,
          );
        } else {
          this.logService.warn(
            'EmailService is not available, skipping notification for missing SKUs.',
            OrderValidationService.name,
            { channelName: channel.name, totalItems: itemsMissingSku.length },
          );
        }
      } catch (error) {
        this.logService.warn(
          'Failed to send email notification for missing SKUs.',
          OrderValidationService.name,
          {
            channelName: channel.name,
            totalItems: itemsMissingSku.length,
            error: error.message,
          },
        );
      }
    }
  }
}
