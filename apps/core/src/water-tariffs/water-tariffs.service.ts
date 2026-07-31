import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ImportBatchStatus,
  ImportBatchType,
  Prisma,
  WaterBillingPeriodStatus,
  WaterTariffCalculationType,
  WaterTariffStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { moneyString, paginate, toDecimal } from '../hydra-shared/money.util';
import { CreateLookupWaterTariffDto } from './dto/create-lookup-water-tariff.dto';
import { CreateTariffTierDto } from './dto/create-tariff-tier.dto';
import { CreateWaterTariffDto } from './dto/create-water-tariff.dto';
import { SimulateWaterTariffDto } from './dto/simulate-water-tariff.dto';
import { UpdateWaterTariffDto } from './dto/update-water-tariff.dto';
import { WaterTariffFilterDto } from './dto/water-tariff-filter.dto';
import { WaterTariffInput } from './interfaces/water-billing-calculator.interface';
import { mapLookupJsonToCreateDto } from './water-tariff-lookup.mapper';
import { WaterBillingCalculatorService } from './water-billing-calculator.service';

@Injectable()
export class WaterTariffsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
    private readonly calculator: WaterBillingCalculatorService,
  ) {}

  private tierData(tier: CreateTariffTierDto, sortOrder: number) {
    return {
      m3: toDecimal(tier.m3, 'm3'),
      fixedAmount: tier.fixedAmount
        ? toDecimal(tier.fixedAmount, 'fixedAmount')
        : undefined,
      amountPerM3: tier.amountPerM3
        ? toDecimal(tier.amountPerM3, 'amountPerM3')
        : undefined,
      calculationType:
        tier.calculationType ?? WaterTariffCalculationType.LOOKUP_BY_M3,
      sortOrder: tier.sortOrder ?? sortOrder,
    };
  }

  async createFromLookupJson(dto: CreateLookupWaterTariffDto, userId: string) {
    const mapped = mapLookupJsonToCreateDto(dto);
    const rateTariffDate = dto.rateTariffDate;
    const [mm, yyyy] = rateTariffDate.split('-').map(Number);
    const periodStart = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0));
    const periodEndExclusive = new Date(Date.UTC(yyyy, mm, 1, 0, 0, 0));

    const existing = await this.findLookupTariffForPeriod(
      dto.residentialComplexId,
      rateTariffDate,
      periodStart,
      periodEndExclusive,
      mapped.name,
    );

    const tariff = existing
      ? await this.update(
          existing.id,
          {
            name: mapped.name,
            rateTariffDate,
            effectiveFrom: mapped.effectiveFrom,
            effectiveTo: mapped.effectiveTo,
            baseCharge: mapped.baseCharge,
            minimumConsumptionM3: mapped.minimumConsumptionM3,
            notes: mapped.notes,
            status: WaterTariffStatus.ACTIVE,
            tiers: mapped.tiers,
          },
          userId,
        )
      : await this.create(mapped, userId);

    const upsertAction = existing ? 'updated' : 'created';

    // Archiva duplicados de la misma vigencia (libera rateTariffDate para el índice único).
    const archivedDuplicates = await this.archiveLookupDuplicates({
      residentialComplexId: dto.residentialComplexId,
      keepTariffId: tariff.id,
      rateTariffDate,
      periodStart,
      periodEndExclusive,
      name: mapped.name,
      userId,
    });

    // Tras upsert, este tarifario es el último cargado (updatedAt).
    // Reasigna periodos abiertos al tarifario de facturación (latest).
    const openPeriods = await this.prisma.waterBillingPeriod.findMany({
      where: {
        residentialComplexId: dto.residentialComplexId,
        status: {
          in: [
            WaterBillingPeriodStatus.DRAFT,
            WaterBillingPeriodStatus.OPEN,
            WaterBillingPeriodStatus.CALCULATED,
          ],
        },
      },
      include: {
        tariff: { include: { _count: { select: { tiers: true } } } },
      },
    });

    const latest = await this.findLatestForBilling(dto.residentialComplexId);
    const billingTariffId = latest?.id ?? tariff.id;
    const periodIdsToRelink = openPeriods
      .filter((period) => {
        if (!period.tariffId || !period.tariff) return true;
        if (period.tariff._count.tiers === 0) return true;
        // Misma vigencia reimportada → actualizar id canónico.
        if (period.tariff.rateTariffDate === rateTariffDate) return true;
        // Periodos que no apuntan al latest de facturación.
        if (period.tariffId !== billingTariffId) return true;
        return false;
      })
      .map((period) => period.id);

    if (periodIdsToRelink.length) {
      await this.prisma.waterBillingPeriod.updateMany({
        where: { id: { in: periodIdsToRelink } },
        data: { tariffId: billingTariffId, updatedBy: userId },
      });
    }

    const payload = JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue;
    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(dto))
      .digest('hex');

    await this.prisma.importBatch.create({
      data: {
        residentialComplexId: dto.residentialComplexId,
        type: ImportBatchType.WATER_TARIFF,
        filename: `water-tariff-${rateTariffDate}.json`,
        checksum,
        status: ImportBatchStatus.PROCESSED,
        totalRows: dto.measures.length,
        validRows: dto.measures.length,
        processedRows: dto.measures.length,
        payload,
        previewData: dto.measures as unknown as Prisma.InputJsonValue,
        relatedEntityType: 'WaterTariff',
        relatedEntityId: tariff.id,
        createdBy: userId,
        processedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'WaterTariff',
      entityId: tariff.id,
      action:
        upsertAction === 'created'
          ? 'WATER_TARIFF_LOOKUP_CREATE'
          : 'WATER_TARIFF_LOOKUP_UPSERT',
      newData: {
        rateTariffDate,
        upsertAction,
        archivedDuplicates,
        measureCount: dto.measures.length,
      },
    });

    return {
      ...tariff,
      upsertAction,
      archivedDuplicates,
      rateTariffDate,
      isLatestForBilling: billingTariffId === tariff.id,
      periodsRelinked: periodIdsToRelink.length,
    };
  }

  /**
   * Localiza el tarifario canónico de una vigencia MM-YYYY (evita duplicar 05-2026).
   */
  private async findLookupTariffForPeriod(
    residentialComplexId: string,
    rateTariffDate: string,
    periodStart: Date,
    periodEndExclusive: Date,
    mappedName: string,
  ) {
    const byDate = await this.prisma.waterTariff.findFirst({
      where: { residentialComplexId, rateTariffDate },
      orderBy: { createdAt: 'desc' },
    });
    if (byDate) return byDate;

    const candidates = await this.prisma.waterTariff.findMany({
      where: {
        residentialComplexId,
        OR: [
          { effectiveFrom: { gte: periodStart, lt: periodEndExclusive } },
          { name: mappedName },
          { name: `Tarifa ${rateTariffDate}` },
        ],
      },
      include: { _count: { select: { tiers: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      const statusRank = (s: WaterTariffStatus) =>
        s === WaterTariffStatus.ACTIVE ? 0 : 1;
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;
      return b._count.tiers - a._count.tiers;
    });

    return candidates[0];
  }

  private async archiveLookupDuplicates(params: {
    residentialComplexId: string;
    keepTariffId: string;
    rateTariffDate: string;
    periodStart: Date;
    periodEndExclusive: Date;
    name: string;
    userId: string;
  }) {
    const duplicates = await this.prisma.waterTariff.findMany({
      where: {
        residentialComplexId: params.residentialComplexId,
        id: { not: params.keepTariffId },
        OR: [
          { rateTariffDate: params.rateTariffDate },
          {
            effectiveFrom: {
              gte: params.periodStart,
              lt: params.periodEndExclusive,
            },
          },
          { name: params.name },
          { name: `Tarifa ${params.rateTariffDate}` },
        ],
      },
      select: { id: true },
    });

    if (!duplicates.length) return 0;

    const ids = duplicates.map((d) => d.id);
    await this.prisma.waterTariff.updateMany({
      where: { id: { in: ids } },
      data: {
        status: WaterTariffStatus.ARCHIVED,
        // Libera la clave única (MySQL permite varios NULL).
        rateTariffDate: null,
        updatedBy: params.userId,
      },
    });

    // Periodos que apuntaban a duplicados pasan al canónico.
    await this.prisma.waterBillingPeriod.updateMany({
      where: { tariffId: { in: ids } },
      data: { tariffId: params.keepTariffId, updatedBy: params.userId },
    });

    return ids.length;
  }

  async create(dto: CreateWaterTariffDto, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: dto.residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');

    if (dto.rateTariffDate) {
      const clash = await this.prisma.waterTariff.findFirst({
        where: {
          residentialComplexId: dto.residentialComplexId,
          rateTariffDate: dto.rateTariffDate,
        },
      });
      if (clash) {
        throw new BadRequestException(
          `Already exists a water tariff for vigencia ${dto.rateTariffDate}. ` +
            'Use POST /water-tariffs/from-lookup-json to upsert.',
        );
      }
    }

    const tariff = await this.prisma.waterTariff.create({
      data: {
        residentialComplexId: dto.residentialComplexId,
        name: dto.name,
        rateTariffDate: dto.rateTariffDate,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        baseCharge: dto.baseCharge ? toDecimal(dto.baseCharge) : undefined,
        minimumConsumptionM3: dto.minimumConsumptionM3
          ? toDecimal(dto.minimumConsumptionM3)
          : undefined,
        discountAmount: dto.discountAmount ? toDecimal(dto.discountAmount) : undefined,
        discountPercentage: dto.discountPercentage
          ? toDecimal(dto.discountPercentage)
          : undefined,
        roundingMode: dto.roundingMode,
        notes: dto.notes,
        createdBy: userId,
        tiers: {
          create: dto.tiers.map((tier, index) => ({
            ...this.tierData(tier, index),
            createdBy: userId,
          })),
        },
      },
      include: { tiers: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.auditService.log({
      userId,
      entityType: 'WaterTariff',
      entityId: tariff.id,
      action: 'WATER_TARIFF_CREATE',
      newData: JSON.parse(JSON.stringify(dto)),
    });

    return tariff;
  }

  async findAll(query: WaterTariffFilterDto): Promise<
    ListResponseDto<any> & {
      latestForBilling: {
        id: string;
        name: string;
        rateTariffDate: string | null;
      } | null;
    }
  > {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.WaterTariffWhereInput = {};
    if (query.residentialComplexId) where.residentialComplexId = query.residentialComplexId;
    where.status = query.status ?? WaterTariffStatus.ACTIVE;

    const [totalRecords, data] = await Promise.all([
      this.prisma.waterTariff.count({ where }),
      this.prisma.waterTariff.findMany({
        where,
        skip,
        take,
        include: { tiers: { orderBy: { sortOrder: 'asc' } } },
        // Última cargada primero (updatedAt), luego calendario.
        orderBy: [
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
          { effectiveFrom: 'desc' },
        ],
      }),
    ]);

    const latest = query.residentialComplexId
      ? await this.findLatestForBilling(query.residentialComplexId)
      : null;
    const latestId = latest?.id ?? null;

    return {
      totalRecords,
      data: data.map((tariff) => ({
        ...tariff,
        tierCount: tariff.tiers.length,
        isLatestForBilling: latestId != null && tariff.id === latestId,
      })),
      latestForBilling: latest
        ? {
            id: latest.id,
            name: latest.name,
            rateTariffDate: latest.rateTariffDate,
          }
        : null,
    };
  }

  /**
   * Tarifario usado en cálculos: última vigencia cargada (ACTIVE, con tiers).
   * Orden: updatedAt DESC (última importación/upsert), luego createdAt, effectiveFrom.
   */
  async findLatestForBilling(residentialComplexId: string) {
    const tariffs = await this.prisma.waterTariff.findMany({
      where: {
        residentialComplexId,
        status: WaterTariffStatus.ACTIVE,
        rateTariffDate: { not: null },
      },
      include: { tiers: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
        { effectiveFrom: 'desc' },
      ],
      take: 20,
    });

    const withTiers = tariffs.find((t) => t.tiers.length > 0);
    return withTiers ?? null;
  }

  async findOne(id: string) {
    const tariff = await this.prisma.waterTariff.findFirst({
      where: { id },
      include: { tiers: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!tariff) throw new NotFoundException('Water tariff not found');
    return tariff;
  }

  async update(id: string, dto: UpdateWaterTariffDto, userId: string) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.tiers) {
        await tx.waterTariffTier.deleteMany({ where: { tariffId: id } });
      }

      const updated = await tx.waterTariff.update({
        where: { id },
        data: {
          name: dto.name,
          rateTariffDate: dto.rateTariffDate,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          baseCharge: dto.baseCharge ? toDecimal(dto.baseCharge) : undefined,
          minimumConsumptionM3: dto.minimumConsumptionM3
            ? toDecimal(dto.minimumConsumptionM3)
            : undefined,
          discountAmount: dto.discountAmount ? toDecimal(dto.discountAmount) : undefined,
          discountPercentage: dto.discountPercentage
            ? toDecimal(dto.discountPercentage)
            : undefined,
          roundingMode: dto.roundingMode,
          status: dto.status,
          notes: dto.notes,
          updatedBy: userId,
          tiers: dto.tiers
            ? {
                create: dto.tiers.map((tier, index) => ({
                  ...this.tierData(tier, index),
                  createdBy: userId,
                })),
              }
            : undefined,
        },
        include: { tiers: { orderBy: { sortOrder: 'asc' } } },
      });

      await this.auditService.log({
        userId,
        entityType: 'WaterTariff',
        entityId: id,
        action: 'WATER_TARIFF_UPDATE',
        newData: JSON.parse(JSON.stringify(dto)),
      });

      return updated;
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.waterTariff.update({
      where: { id },
      data: { status: WaterTariffStatus.ARCHIVED },
    });
    await this.auditService.log({
      userId,
      entityType: 'WaterTariff',
      entityId: id,
      action: 'WATER_TARIFF_ARCHIVE',
    });
    return { success: true };
  }

  toCalculatorInput(tariff: {
    baseCharge: any;
    minimumConsumptionM3: any;
    discountAmount: any;
    discountPercentage: any;
    roundingMode: any;
    tiers: any[];
  }): WaterTariffInput {
    return {
      baseCharge: moneyString(tariff.baseCharge),
      minimumConsumptionM3: tariff.minimumConsumptionM3?.toString() ?? '0',
      discountAmount: moneyString(tariff.discountAmount),
      discountPercentage: tariff.discountPercentage?.toString() ?? '0',
      roundingMode: tariff.roundingMode,
      tiers: tariff.tiers.map((tier) => ({
        id: tier.id,
        m3: tier.m3.toString(),
        fixedAmount: moneyString(tier.fixedAmount),
        amountPerM3: tier.amountPerM3?.toString() ?? '0',
        calculationType: tier.calculationType,
        sortOrder: tier.sortOrder,
      })),
    };
  }

  async simulate(id: string, dto: SimulateWaterTariffDto) {
    const tariff = await this.findOne(id);
    if (!tariff.tiers.length) {
      throw new BadRequestException('Tariff has no tiers configured');
    }
    return this.calculator.calculate(dto, this.toCalculatorInput(tariff));
  }
}
