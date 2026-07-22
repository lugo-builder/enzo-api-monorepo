import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CatalogItemStatus } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';

import {
  AccountSettingsRepoService,
  CatalogItemRepoService,
  DatabaseService,
} from '@app/database';
import { LogService } from '@app/log';

@Injectable()
export class UpcAssociationService {
  private readonly restNextCloudUrl: string;
  private readonly api: AxiosInstance;
  private readonly logService: LogService;

  constructor(
    private readonly prisma: DatabaseService,
    private readonly accountSettingsRepoService: AccountSettingsRepoService,
    private readonly catalogItemRepoService: CatalogItemRepoService,
    private readonly moduleRef: ModuleRef,
  ) {
    this.logService = this.moduleRef.get(LogService, { strict: false });
    this.restNextCloudUrl = process.env.API_REST_NEXT_CLOUD_URL;
    this.api = axios.create({
      baseURL: this.restNextCloudUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Associates items using UPC codes from custom_s5 attribute via Next Cloud API
   * @param userId - The user ID to process items for
   */
  async associateItemsByUpc(userId: string) {
    this.logService.info(
      'Starting UPC validation for user',
      UpcAssociationService.name,
      { userId },
    );

    try {
      // Get all catalog items for the user that have custom_s5 (UPC) data
      const catalogItems = await this.catalogItemRepoService.findMany({
        where: {
          userId,
          customKey: 'custom_s5',
          customValue: { not: null },
          status: { not: CatalogItemStatus.SUCCESS },
        },
        select: {
          id: true,
          productId: true,
          customValue: true,
          skuChannel: true,
        },
      });

      if (catalogItems.length === 0) {
        this.logService.info(
          'No catalog items found with custom_s5 data',
          UpcAssociationService.name,
          { userId },
        );
        return { message: 'No items found with UPC data to validate' };
      }

      // Get account settings and provider settings for API authentication
      const accountSettings = await this.accountSettingsRepoService.findUnique({
        where: { userId },
        include: { logisticProviderCredentials: true },
      });

      if (!accountSettings?.logisticProviderCredentials) {
        this.logService.warn(
          'Logistic provider credentials not found for user',
          UpcAssociationService.name,
          { userId },
        );
        return { message: 'Logistic provider credentials not found' };
      }

      const logisticProviderCredentials =
        accountSettings.logisticProviderCredentials;

      this.api.defaults.headers['Authorization'] =
        logisticProviderCredentials.token;

      const sectionId = logisticProviderCredentials?.sectionId;

      // Process items in batches of 1000 (API limit)
      const batchSize = 1000;
      let totalUpdatedCount = 0;
      let totalNotFoundCount = 0;

      for (let i = 0; i < catalogItems.length; i += batchSize) {
        const batch = catalogItems.slice(i, i + batchSize);
        const { updatedCount, notFoundCount } = await this.processUpcBatch(
          userId,
          sectionId,
          batch,
        );
        totalUpdatedCount += updatedCount;
        totalNotFoundCount += notFoundCount;
      }

      this.logService.info(
        'UPC validation completed',
        UpcAssociationService.name,
        {
          userId,
          totalItems: catalogItems.length,
          totalUpdatedCount,
          totalNotFoundCount,
        },
      );

      return {
        message: 'UPC validation completed successfully',
        totalItems: catalogItems.length,
        updatedCount: totalUpdatedCount,
        notFoundCount: totalNotFoundCount,
      };
    } catch (error) {
      this.logService.error(
        'Error in UPC validation process',
        UpcAssociationService.name,
        { userId, error: error?.response || error?.message || error },
      );
      // Don't throw - allow the flow to continue even if UPC validation fails
      return {
        message: 'UPC validation failed',
        error: error?.message || 'Unknown error',
      };
    }
  }

  /**
   * Processes a batch of catalog items for UPC validation
   * @param userId - The user ID
   * @param sectionId - The section ID for API validation
   * @param catalogItems - Batch of catalog items to process
   * @returns Object with updated and not found counts
   */
  private async processUpcBatch(
    userId: string,
    sectionId: string,
    catalogItems: Array<{
      id: string;
      productId: string | null;
      customValue: string | null;
      skuChannel: string;
    }>,
  ) {
    // Extract UPCs from customValue and filter valid ones
    const upcs = catalogItems
      .map((item) => item.customValue)
      .filter((upc) => upc && upc.trim() !== '');

    if (upcs.length === 0) {
      this.logService.info(
        'No valid UPCs found in batch',
        UpcAssociationService.name,
        { userId, batchSize: catalogItems.length },
      );
      return { updatedCount: 0, notFoundCount: catalogItems.length };
    }

    // Call Next Cloud API to validate UPCs
    const response = await this.api.post(
      `/rest/next/core/articles/validate/items`,
      {
        upc: upcs,
        id_seccion: sectionId,
      },
    );

    this.logService.info(
      'Next Cloud UPC validation response for batch',
      UpcAssociationService.name,
      { userId, batchSize: upcs.length, response: response?.data },
    );

    if (!response?.data || response?.data?.error !== 0) {
      this.logService.error(
        'Invalid response from Next Cloud API',
        UpcAssociationService.name,
        { userId, response: response?.data },
      );
      return { updatedCount: 0, notFoundCount: catalogItems.length };
    }

    // Process the response and create mapping
    const validationResults = response.data.datos || [];
    const upcToSkuMap = new Map<string, string>();

    // Create mapping of UPC to SKU for items that exist
    for (const result of validationResults) {
      if (Number(result.existe) === 1 && result.sku) {
        upcToSkuMap.set(String(result.upc), String(result.sku));
      }
    }

    // Prepare batch updates
    const updatesToApply: Array<{
      id: string;
      skuErp?: string;
      status: CatalogItemStatus;
      errorMessage?: string | null;
    }> = [];

    // Categorize items for batch updates
    for (const catalogItem of catalogItems) {
      const upc = catalogItem.customValue;
      const sku = upcToSkuMap.get(upc);

      if (sku) {
        // SKU found
        updatesToApply.push({
          id: catalogItem.id,
          skuErp: sku,
          status: CatalogItemStatus.SUCCESS,
          errorMessage: null,
        });
      } else {
        // SKU not found
        updatesToApply.push({
          id: catalogItem.id,
          status: CatalogItemStatus.ERROR,
          errorMessage: 'No se pudo localizar el SKU ERP',
        });
      }
    }

    // Apply batch updates
    await this.applyUpcBatchUpdates(updatesToApply);

    const updatedCount = updatesToApply.filter(
      (update) => update.status === CatalogItemStatus.SUCCESS,
    ).length;
    const notFoundCount = updatesToApply.filter(
      (update) => update.status === CatalogItemStatus.ERROR,
    ).length;

    this.logService.info(
      'UPC batch processing completed',
      UpcAssociationService.name,
      {
        userId,
        batchSize: catalogItems.length,
        updatedCount,
        notFoundCount,
      },
    );

    return { updatedCount, notFoundCount };
  }

  /**
   * Applies batch updates to catalog items using Prisma transaction
   * @param updates - Array of updates to apply
   */
  private async applyUpcBatchUpdates(
    updates: Array<{
      id: string;
      skuErp?: string;
      status: CatalogItemStatus;
      errorMessage?: string | null;
    }>,
  ) {
    // Use Prisma transaction for batch updates
    await this.prisma.$transaction(
      updates.map((update) =>
        this.catalogItemRepoService.update({
          where: { id: update.id },
          data: {
            skuErp: update.skuErp,
            status: update.status,
            errorMessage: update.errorMessage,
          },
        }),
      ),
    );
  }
}
