import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import {
  CatalogItemRepoService,
  ChannelsRepoService,
  DatabaseService,
} from '@app/database';
import { LogService } from '@app/log';

/** Local types when Prisma schema does not include catalog enums */
const CatalogItemStatus = {} as Record<string, string>;
const SkusAssignmentType = {} as Record<string, string>;
import { customAlphabet } from 'nanoid';
import { CustomException, ErrorCodes } from '../utils';
import { OrderValidationService } from './order-validation.service';

@Injectable()
export class SkusService {
  private readonly logService: LogService;
  private readonly orderValidationService: OrderValidationService;

  constructor(
    private readonly prisma: DatabaseService,
    private readonly catalogItemRepoService: CatalogItemRepoService,
    private readonly channelsRepoService: ChannelsRepoService,
    private readonly moduleRef: ModuleRef,
  ) {
    this.logService = this.moduleRef.get(LogService, { strict: false });
    this.orderValidationService = this.moduleRef.get(OrderValidationService, {
      strict: false,
    });
  }

  async associateSkusAutomatically(channelId: string) {
    this.logService.info(
      'start associateSkusAutomatically',
      SkusService.name,
      channelId,
    );

    const catalogItems = await this.catalogItemRepoService.findMany({
      where: {
        channelId,
        // status: {
        //   not: CatalogItemStatus.SUCCESS,
        // },
        status: CatalogItemStatus.PENDING,
      },
      select: {
        id: true,
        skuChannel: true,
      },
    });

    const catalogItemsToUpdate = catalogItems.map((item) => ({
      id: item.id,
      skuErp: this.generateSKU(),
    }));

    const cases = catalogItemsToUpdate
      .map((item) => `WHEN '${item.id}' THEN '${item.skuErp}'`)
      .join(' ');

    const skuList = catalogItemsToUpdate
      .map((item) => `'${item.id}'`)
      .join(', ');

    const query = `
      UPDATE catalog_item
      SET status = 'PENDING_CREATION_ERP', errorMessage = NULL, skuErp = CASE id
        ${cases}
      END
      WHERE id IN (${skuList})
      AND status != 'SUCCESS';
    `;

    this.logService.info(
      'query - associateSkusAutomatically',
      SkusService.name,
      query,
    );

    await this.prisma.$executeRawUnsafe(query);

    await this.channelsRepoService.update({
      where: { id: channelId },
      data: {
        skusAssignmentType: SkusAssignmentType.AUTOMATICALLY,
      },
    });
  }

  async associateSkusAutomaticallyV2(userId: string) {
    this.logService.info(
      'start associateSkusAutomaticallyV2',
      SkusService.name,
      { userId },
    );

    // Get catalog items for this user that need SKU assignment
    const catalogItems = await this.catalogItemRepoService.findMany({
      where: {
        userId,
        status: CatalogItemStatus.PENDING,
        deletedAt: null,
      },
      select: {
        id: true,
        skuChannel: true,
        productId: true,
      },
    });

    if (catalogItems.length === 0) {
      this.logService.info(
        'No catalog items found for automatic SKU assignment',
        SkusService.name,
        { userId },
      );
      return;
    }

    this.logService.info(
      'Found catalog items for automatic SKU assignment',
      SkusService.name,
      {
        userId,
        itemsCount: catalogItems.length,
      },
    );

    // Generate SKUs for each item
    const catalogItemsToUpdate = catalogItems.map((item) => ({
      id: item.id,
      skuErp: this.generateSKU(),
    }));

    const cases = catalogItemsToUpdate
      .map((item) => `WHEN '${item.id}' THEN '${item.skuErp}'`)
      .join(' ');

    const skuList = catalogItemsToUpdate
      .map((item) => `'${item.id}'`)
      .join(', ');

    const query = `
      UPDATE catalog_item
      SET status = 'PENDING_CREATION_ERP', errorMessage = NULL, skuErp = CASE id
        ${cases}
      END
      WHERE id IN (${skuList})
      AND status != 'SUCCESS'
      AND deletedAt IS NULL;
    `;

    this.logService.info(
      'Executing automatic SKU assignment query',
      SkusService.name,
      { userId, query },
    );

    await this.prisma.$executeRawUnsafe(query);

    // Update account settings to reflect that automatic assignment was performed
    await this.prisma.accountSettings.update({
      where: { userId },
      data: {
        skusAssignmentType: SkusAssignmentType.AUTOMATICALLY,
        updatedAt: new Date(),
        updatedBy: 'system',
      },
    });

    this.logService.info(
      'Automatic SKU assignment completed successfully',
      SkusService.name,
      {
        userId,
        itemsProcessed: catalogItemsToUpdate.length,
      },
    );
  }

  generateSKU(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const nanoid = customAlphabet(alphabet, 16);
    return nanoid();
  }

  validateSkuErp(
    skuErp: string,
    existingErpSkus: string[],
    mustHaveExistence: boolean,
    validateFormat: boolean = true,
  ): string | null {
    if (!skuErp) return 'No se ingresó un SKU para el ERP';

    if (validateFormat && !/^[A-Za-z0-9._-]+$/.test(skuErp)) {
      return `El SKU "${skuErp}" para el ERP debe contener solo letras, números, puntos, guiones y guiones bajos`;
    }

    if (skuErp.length > 18) {
      return `El SKU "${skuErp}" para el ERP debe tener máximo 18 caracteres`;
    }

    if (mustHaveExistence && !existingErpSkus.includes(skuErp)) {
      return `El SKU "${skuErp}" no existe en el ERP`;
    }

    if (!mustHaveExistence && existingErpSkus.includes(skuErp)) {
      return `El SKU "${skuErp}" ya existe en el ERP`;
    }

    return null;
  }

  async automaticReuseOfSkus({
    channelId,
    userId,
    status = [CatalogItemStatus.SUCCESS],
  }: {
    channelId?: string;
    userId?: string;
    status?: CatalogItemStatus | CatalogItemStatus[];
  }) {
    if (!userId && !channelId) {
      this.logService.error(
        'Automatic reuse of SKUs failed, userId or channelId is required',
        SkusService.name,
        { channelId, userId },
      );
      throw new CustomException(ErrorCodes.BAD_REQUEST);
    }

    if (!userId) {
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
      });

      if (!channel) {
        this.logService.error(
          'Automatic reuse of SKUs failed, channel not found',
          SkusService.name,
          { channelId },
        );
        throw new CustomException(ErrorCodes.CHANNEL_NOT_FOUND);
      }

      userId = channel.userId;
    }

    // Normalize status to array
    const statusArray = Array.isArray(status) ? status : [status];

    // Create the status condition for the query
    const statusConditions = statusArray.map((s) => `'${s}'`).join(', ');

    await this.prisma.$executeRawUnsafe(
      `
        WITH source_items AS (
          SELECT
              ci.skuChannel,
              ci.productId,
              ci.skuErp,
              ci.status,
              lpc.token,
              ROW_NUMBER() OVER(PARTITION BY lpc.token, ci.productId ORDER BY ci.createdAt DESC) as rn
          FROM
              catalog_item ci
          JOIN
              channel ch ON ci.channelId = ch.id
          JOIN
              logistic_provider_credentials lpc ON ch.logisticProviderCredentialsId = lpc.id
          WHERE
              ci.status IN (${statusConditions})
              AND ci.skuErp IS NOT NULL
              AND ci.deletedAt IS NULL
              AND ch.deletedAt IS NULL
              AND lpc.deletedAt IS NULL
      )
      UPDATE
          catalog_item AS ci_target
      JOIN
          channel AS ch_target ON ci_target.channelId = ch_target.id
      JOIN
          logistic_provider_credentials AS lpc_target ON ch_target.logisticProviderCredentialsId = lpc_target.id
      JOIN
          source_items ON ci_target.productId = source_items.productId AND lpc_target.token = source_items.token
      SET
          ci_target.skuErp = source_items.skuErp,
          ci_target.status = source_items.status
      WHERE
          source_items.rn = 1
          AND ch_target.userId = ?
          AND ci_target.deletedAt IS NULL
          AND ch_target.deletedAt IS NULL
          AND lpc_target.deletedAt IS NULL
          AND ci_target.status NOT IN (${statusConditions});
      `,
      userId,
    );

    // Validate and associate ERP SKUs to order items after reusing SKUs
    await this.orderValidationService.validateAndAssociateErpSkusToTheOrderItems(
      userId,
    );

    return {
      userId,
    };
  }
}
