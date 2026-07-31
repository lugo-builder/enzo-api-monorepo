import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ChargeCategory,
  ChargeMovementType,
  ImportBatchStatus,
  ImportBatchType,
  Prisma,
  ResidentialUnitStatus,
  UnitChargeSource,
  UnitChargeStatus,
  WaterBillingPeriodStatus,
  WaterMeterStatus,
  WaterReadingCalculationMode,
  WaterReadingStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import {
  BulkProcessErrorDto,
  bulkResponse,
} from '../hydra-shared/bulk-process-response.dto';
import { moneyString, paginate, toDecimal } from '../hydra-shared/money.util';
import { sortByUnitNumber } from '../hydra-shared/unit-order.util';
import { WaterTariffsService } from '../water-tariffs/water-tariffs.service';
import { WaterBillingCalculatorService } from '../water-tariffs/water-billing-calculator.service';
import { CreateWaterPeriodDto } from './dto/create-water-period.dto';
import { ApplyCeaProrationDto } from './dto/apply-cea-proration.dto';
import { ImportWaterReadingsJsonDto } from './dto/import-water-readings-json.dto';
import { UpdateWaterPeriodDto } from './dto/update-water-period.dto';
import { WaterPeriodFilterDto } from './dto/water-period-filter.dto';

@Injectable()
export class WaterPeriodsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
    private readonly calculator: WaterBillingCalculatorService,
    private readonly waterTariffsService: WaterTariffsService,
  ) {}

  async create(dto: CreateWaterPeriodDto, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: dto.residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');

    const existing = await this.prisma.waterBillingPeriod.findUnique({
      where: {
        residentialComplexId_billingYear_billingMonth: {
          residentialComplexId: dto.residentialComplexId,
          billingYear: dto.billingYear,
          billingMonth: dto.billingMonth,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A water billing period already exists for this residentialComplex/year/month',
      );
    }

    const latestTariff = await this.waterTariffsService.findLatestForBilling(
      dto.residentialComplexId,
    );
    const tariffId = dto.tariffId ?? latestTariff?.id;

    const period = await this.prisma.waterBillingPeriod.create({
      data: {
        residentialComplexId: dto.residentialComplexId,
        name: dto.name,
        readingStartDate: dto.readingStartDate ? new Date(dto.readingStartDate) : undefined,
        readingEndDate: dto.readingEndDate ? new Date(dto.readingEndDate) : undefined,
        billingYear: dto.billingYear,
        billingMonth: dto.billingMonth,
        tariffId,
        notes: dto.notes,
        ceaBillTotalCost: dto.ceaBillTotalCost
          ? toDecimal(dto.ceaBillTotalCost, 'ceaBillTotalCost')
          : undefined,
        macrometerM3FromBill: dto.macrometerM3FromBill
          ? toDecimal(dto.macrometerM3FromBill, 'macrometerM3FromBill')
          : undefined,
        physicalMacrometerM3: dto.physicalMacrometerM3
          ? toDecimal(dto.physicalMacrometerM3, 'physicalMacrometerM3')
          : undefined,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: period.id,
      action: 'WATER_PERIOD_CREATE',
      newData: { ...dto },
    });

    return period;
  }

  async findAll(query: WaterPeriodFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.WaterBillingPeriodWhereInput = {};
    if (query.residentialComplexId) where.residentialComplexId = query.residentialComplexId;
    if (query.status) where.status = query.status;
    if (query.billingYear) where.billingYear = query.billingYear;
    if (query.billingMonth) where.billingMonth = query.billingMonth;

    const [totalRecords, data] = await Promise.all([
      this.prisma.waterBillingPeriod.count({ where }),
      this.prisma.waterBillingPeriod.findMany({
        where,
        skip,
        take,
        orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
      }),
    ]);
    return { totalRecords, data };
  }

  async findOne(id: string) {
    const period = await this.prisma.waterBillingPeriod.findUnique({
      where: { id },
      include: { tariff: { include: { tiers: true } } },
    });
    if (!period) throw new NotFoundException('Water billing period not found');
    return period;
  }

  async update(id: string, dto: UpdateWaterPeriodDto, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.waterBillingPeriod.update({
      where: { id },
      data: {
        name: dto.name,
        readingStartDate: dto.readingStartDate ? new Date(dto.readingStartDate) : undefined,
        readingEndDate: dto.readingEndDate ? new Date(dto.readingEndDate) : undefined,
        tariffId: dto.tariffId,
        notes: dto.notes,
        ...(dto.ceaBillTotalCost !== undefined
          ? {
              ceaBillTotalCost: dto.ceaBillTotalCost
                ? toDecimal(dto.ceaBillTotalCost, 'ceaBillTotalCost')
                : null,
            }
          : {}),
        ...(dto.macrometerM3FromBill !== undefined
          ? {
              macrometerM3FromBill: dto.macrometerM3FromBill
                ? toDecimal(dto.macrometerM3FromBill, 'macrometerM3FromBill')
                : null,
            }
          : {}),
        ...(dto.physicalMacrometerM3 !== undefined
          ? {
              physicalMacrometerM3: dto.physicalMacrometerM3
                ? toDecimal(dto.physicalMacrometerM3, 'physicalMacrometerM3')
                : null,
            }
          : {}),
        updatedBy: userId,
      },
    });
    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: id,
      action: 'WATER_PERIOD_UPDATE',
      newData: { ...dto },
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.waterBillingPeriod.update({
      where: { id },
      data: { status: WaterBillingPeriodStatus.CANCELLED, updatedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: id,
      action: 'WATER_PERIOD_CANCEL',
    });
    return updated;
  }

  async getReadings(
    periodId: string,
    options?: { inheritFromPrevious?: boolean; userId?: string },
  ) {
    const period = await this.findOne(periodId);
    if (options?.inheritFromPrevious) {
      await this.syncInheritedPreviousReadings(
        period,
        options.userId ?? 'system',
      );
    }
    const readings = await this.prisma.waterReading.findMany({
      where: { billingPeriodId: periodId },
      include: { unit: true, waterMeter: true },
    });
    return sortByUnitNumber(readings, (r) => r.unit.unitNumber);
  }

  /**
   * Reporte CEA del periodo: casa, medidor, lecturas, m³, macro, total a pagar.
   * Fuente de verdad: WaterReading (tras import JSON + calculate).
   */
  async getReport(periodId: string) {
    const period = await this.findOne(periodId);
    const activeUnits = await this.prisma.residentialUnit.count({
      where: {
        residentialComplexId: period.residentialComplexId,
        status: ResidentialUnitStatus.ACTIVE,
        deletedAt: null,
      },
    });

    const readings = sortByUnitNumber(
      await this.prisma.waterReading.findMany({
        where: { billingPeriodId: periodId, status: { not: WaterReadingStatus.CANCELLED } },
        include: { unit: true, waterMeter: true },
      }),
      (r) => r.unit.unitNumber,
    );

    let totalWaterAmount = new Decimal(0);
    let totalServiceFee = new Decimal(0);
    let totalConsumptionM3 = new Decimal(0);
    let totalMacroDifferencePrice = new Decimal(0);
    const rows = readings.map((reading) => {
      const total = toDecimal(reading.finalAmount ?? 0);
      const serviceFee = toDecimal(reading.serviceFeeAmount ?? 0);
      const consumption = toDecimal(reading.consumptionM3 ?? 0);
      const macro = toDecimal(reading.macroDifferencePrice ?? 0);
      totalWaterAmount = totalWaterAmount.plus(total);
      totalServiceFee = totalServiceFee.plus(serviceFee);
      totalConsumptionM3 = totalConsumptionM3.plus(consumption);
      totalMacroDifferencePrice = totalMacroDifferencePrice.plus(macro);
      return {
        unitNumber: reading.unit.unitNumber,
        meterSerial: reading.waterMeter?.serialNumber ?? null,
        previousReading: moneyString(reading.previousReading),
        currentReading: moneyString(reading.currentReading),
        consumptionM3: moneyString(reading.consumptionM3),
        macroDifferencePrice: moneyString(reading.macroDifferencePrice),
        waterAmount: moneyString(reading.calculatedAmount ?? 0),
        serviceFeeAmount: moneyString(serviceFee),
        totalAmount: moneyString(total),
        status: reading.status,
      };
    });

    const calculatedCount = readings.filter(
      (r) => r.status === WaterReadingStatus.CALCULATED,
    ).length;

    const priceService =
      readings.length > 0
        ? moneyString(readings[0].serviceFeeAmount ?? 0)
        : '0.00';

    const macrometerM3FromBill = period.macrometerM3FromBill
      ? moneyString(period.macrometerM3FromBill)
      : null;
    const physicalMacrometerM3 = period.physicalMacrometerM3
      ? moneyString(period.physicalMacrometerM3)
      : null;
    const macroDifferenceM3 =
      period.macrometerM3FromBill != null && period.physicalMacrometerM3 != null
        ? moneyString(
            toDecimal(period.macrometerM3FromBill).minus(
              toDecimal(period.physicalMacrometerM3),
            ),
          )
        : null;

    return {
      period: {
        id: period.id,
        name: period.name,
        billingYear: period.billingYear,
        billingMonth: period.billingMonth,
        status: period.status,
        readingStartDate: period.readingStartDate,
        readingEndDate: period.readingEndDate,
        notes: period.notes,
        ceaBillTotalCost: period.ceaBillTotalCost
          ? moneyString(period.ceaBillTotalCost)
          : null,
        macrometerM3FromBill,
        physicalMacrometerM3,
        tariff: period.tariff
          ? { id: period.tariff.id, name: period.tariff.name }
          : null,
      },
      fileNameHint: `${period.billingMonth}_${period.billingYear}_CEA_Lecturas_Hydra_Final`,
      summary: {
        expectedUnits: activeUnits,
        readingsCount: readings.length,
        calculatedCount,
        missingUnits: Math.max(0, activeUnits - readings.length),
        priceService,
        totalServiceFee: moneyString(totalServiceFee),
        totalWaterAmount: moneyString(totalWaterAmount),
        totalConsumptionM3: moneyString(totalConsumptionM3),
        totalMacroDifferencePrice: moneyString(totalMacroDifferencePrice),
        totalTariffWaterAmount: moneyString(
          readings.reduce(
            (acc, r) => acc.plus(toDecimal(r.calculatedAmount ?? 0)),
            new Decimal(0),
          ),
        ),
        ceaBillTotalCost: period.ceaBillTotalCost
          ? moneyString(period.ceaBillTotalCost)
          : null,
        macrometerM3FromBill,
        physicalMacrometerM3,
        macroDifferenceM3,
        prorationPerUnit:
          readings.length > 0
            ? moneyString(readings[0].macroDifferencePrice ?? 0)
            : null,
      },
      rows,
    };
  }

  /**
   * Importa lecturas desde JSON (folio/casa + inicial + final).
   * Opcionalmente ejecuta calculate() para generar costos con el tarifario del periodo.
   */
  async importReadingsFromJson(
    periodId: string,
    dto: ImportWaterReadingsJsonDto,
    userId: string,
  ) {
    const period = await this.findOne(periodId);
    if (
      period.status === WaterBillingPeriodStatus.CLOSED ||
      period.status === WaterBillingPeriodStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot import readings into a CLOSED or CANCELLED water billing period',
      );
    }

    const errors: BulkProcessErrorDto[] = [];
    let processed = 0;
    let created = 0;
    let updated = 0;
    const seenKeys = new Set<string>();
    const serviceFee = dto.priceService
      ? toDecimal(dto.priceService, 'priceService')
      : toDecimal('0');
    const defaultMacro = dto.macroDifferencePrice
      ? roundToMoney(toDecimal(dto.macroDifferencePrice, 'macroDifferencePrice'))
      : null;

    if (dto.ceaBill) {
      await this.prisma.waterBillingPeriod.update({
        where: { id: periodId },
        data: {
          ...(dto.ceaBill.totalCost !== undefined
            ? {
                ceaBillTotalCost: toDecimal(
                  dto.ceaBill.totalCost,
                  'ceaBill.totalCost',
                ),
              }
            : {}),
          ...(dto.ceaBill.macrometerM3FromBill !== undefined
            ? {
                macrometerM3FromBill: toDecimal(
                  dto.ceaBill.macrometerM3FromBill,
                  'ceaBill.macrometerM3FromBill',
                ),
              }
            : {}),
          ...(dto.ceaBill.physicalMacrometerM3 !== undefined
            ? {
                physicalMacrometerM3: toDecimal(
                  dto.ceaBill.physicalMacrometerM3,
                  'ceaBill.physicalMacrometerM3',
                ),
              }
            : {}),
          updatedBy: userId,
        },
      });
    }

    for (let i = 0; i < dto.readings.length; i++) {
      const row = dto.readings[i];
      const rowNum = i + 1;
      try {
        if (!row.meterSerial && !row.unitNumber) {
          throw new BadRequestException(
            'Each reading requires meterSerial or unitNumber',
          );
        }

        const identityKey = row.meterSerial
          ? `meter:${row.meterSerial}`
          : `unit:${row.unitNumber}`;
        if (seenKeys.has(identityKey)) {
          throw new BadRequestException(`Duplicate reading for ${identityKey}`);
        }
        seenKeys.add(identityKey);

        const resolved = await this.resolveUnitAndMeter(
          period.residentialComplexId,
          row.meterSerial,
          row.unitNumber,
        );

        const previous = roundToMoney(toDecimal(row.previousReading, 'previousReading'));
        const current = roundToMoney(toDecimal(row.currentReading, 'currentReading'));
        const macro = roundToMoney(
          row.macroDifferencePrice !== undefined
            ? toDecimal(row.macroDifferencePrice, 'macroDifferencePrice')
            : defaultMacro ?? toDecimal('0'),
        );
        const mode =
          row.calculationMode ?? WaterReadingCalculationMode.ACTUAL;

        if (
          current.lt(previous) &&
          mode !== WaterReadingCalculationMode.METER_REPLACEMENT
        ) {
          throw new BadRequestException(
            'currentReading cannot be lower than previousReading unless calculationMode is METER_REPLACEMENT',
          );
        }

        const existing = await this.prisma.waterReading.findUnique({
          where: {
            billingPeriodId_unitId: {
              billingPeriodId: periodId,
              unitId: resolved.unit.id,
            },
          },
        });

        if (existing?.status === WaterReadingStatus.CANCELLED) {
          throw new BadRequestException(
            `Cancelled reading exists for unit ${resolved.unit.unitNumber}; cannot overwrite`,
          );
        }

        const consumptionPreview = roundToMoney(current.minus(previous));
        const payload = {
          waterMeterId: resolved.meter.id,
          previousReading: previous,
          currentReading: current,
          macroDifferencePrice: macro,
          serviceFeeAmount: roundToMoney(serviceFee),
          calculationMode: mode,
          notes: row.notes ?? null,
          // Al reimportar se invalidan montos previos hasta recalcular.
          consumptionM3: consumptionPreview,
          adjustedConsumptionM3: roundToMoney(toDecimal('0')),
          baseAmount: roundToMoney(toDecimal('0')),
          calculatedAmount: roundToMoney(toDecimal('0')),
          finalAmount: roundToMoney(toDecimal('0')),
          status: WaterReadingStatus.CAPTURED,
        };

        await this.prisma.waterReading.upsert({
          where: {
            billingPeriodId_unitId: {
              billingPeriodId: periodId,
              unitId: resolved.unit.id,
            },
          },
          create: {
            billingPeriodId: periodId,
            unitId: resolved.unit.id,
            ...payload,
            createdBy: userId,
          },
          update: {
            ...payload,
            updatedBy: userId,
          },
        });

        if (existing) {
          updated += 1;
        } else {
          created += 1;
        }
        processed += 1;
      } catch (error: any) {
        errors.push({
          row: rowNum,
          unitNumber: row.unitNumber,
          code: 'IMPORT_READING_ERROR',
          message: error?.message ?? 'Unknown error importing reading',
        });
      }
    }

    if (
      processed > 0 &&
      (period.status === WaterBillingPeriodStatus.DRAFT ||
        period.status === WaterBillingPeriodStatus.CALCULATED)
    ) {
      await this.prisma.waterBillingPeriod.update({
        where: { id: periodId },
        data: { status: WaterBillingPeriodStatus.OPEN, updatedBy: userId },
      });
    }

    const payloadJson = JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue;
    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(dto))
      .digest('hex');
    const batchStatus =
      errors.length === 0
        ? ImportBatchStatus.PROCESSED
        : processed > 0
          ? ImportBatchStatus.PARTIAL
          : ImportBatchStatus.FAILED;

    const readingsBatch = await this.prisma.importBatch.create({
      data: {
        residentialComplexId: period.residentialComplexId,
        type: ImportBatchType.WATER_READINGS,
        filename: `water-readings-${period.billingYear}-${period.billingMonth}.json`,
        checksum,
        status: batchStatus,
        totalRows: dto.readings.length,
        validRows: processed,
        invalidRows: errors.length,
        processedRows: processed,
        payload: payloadJson,
        previewData: dto.readings as unknown as Prisma.InputJsonValue,
        errorReport:
          errors.length > 0
            ? (errors as unknown as Prisma.InputJsonValue)
            : undefined,
        relatedEntityType: 'WaterBillingPeriod',
        relatedEntityId: periodId,
        createdBy: userId,
        processedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: periodId,
      action: 'WATER_PERIOD_IMPORT_READINGS_JSON',
      newData: JSON.parse(
        JSON.stringify({
          importBatchId: readingsBatch.id,
          processed,
          created,
          updated,
          failed: errors.length,
          total: dto.readings.length,
          priceService: moneyString(serviceFee),
          macroDifferencePrice: defaultMacro ? moneyString(defaultMacro) : null,
          ceaBill: dto.ceaBill ?? null,
        }),
      ),
    });

    const importResult = {
      ...bulkResponse(dto.readings.length, processed, errors),
      importBatchId: readingsBatch.id,
      summary: {
        total: dto.readings.length,
        processed,
        created,
        updated,
        failed: errors.length,
      },
    };

    const shouldCalculate = dto.calculate !== false;
    if (shouldCalculate && errors.length === 0 && processed > 0) {
      const calculateResult = await this.calculate(periodId, userId);
      const report = await this.getReport(periodId);
      const reportBatch = await this.persistConsumptionReport(
        period.residentialComplexId,
        periodId,
        report,
        userId,
      );
      return {
        import: importResult,
        calculate: calculateResult,
        report,
        reportImportBatchId: reportBatch.id,
      };
    }

    return {
      import: importResult,
      calculate: null,
      report: await this.getReport(periodId),
      reportImportBatchId: null,
    };
  }

  /** Guarda el reporte de consumo calculado como evidencia JSON tipada. */
  private async persistConsumptionReport(
    residentialComplexId: string,
    periodId: string,
    report: unknown,
    userId: string,
  ) {
    const payload = JSON.parse(JSON.stringify(report)) as Prisma.InputJsonValue;
    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(report))
      .digest('hex');
    const rows = Array.isArray((report as any)?.rows)
      ? (report as any).rows.length
      : 0;

    return this.prisma.importBatch.create({
      data: {
        residentialComplexId,
        type: ImportBatchType.WATER_CONSUMPTION_REPORT,
        filename: `water-consumption-report-${periodId}.json`,
        checksum,
        status: ImportBatchStatus.PROCESSED,
        totalRows: rows,
        validRows: rows,
        processedRows: rows,
        payload,
        previewData: ((report as any)?.rows ??
          null) as Prisma.InputJsonValue,
        relatedEntityType: 'WaterBillingPeriod',
        relatedEntityId: periodId,
        createdBy: userId,
        processedAt: new Date(),
      },
    });
  }

  private async resolveUnitAndMeter(
    residentialComplexId: string,
    meterSerial?: string,
    unitNumber?: string,
  ) {
    if (meterSerial) {
      const meter = await this.prisma.waterMeter.findFirst({
        where: {
          serialNumber: meterSerial,
          status: WaterMeterStatus.ACTIVE,
          deletedAt: null,
          unit: { residentialComplexId, deletedAt: null },
        },
        include: { unit: true },
      });
      if (!meter) {
        throw new NotFoundException(
          `Active water meter with serial "${meterSerial}" not found in this residential complex`,
        );
      }
      return { unit: meter.unit, meter };
    }

    const unit = await this.prisma.residentialUnit.findFirst({
      where: {
        residentialComplexId,
        unitNumber: String(unitNumber),
        deletedAt: null,
      },
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${unitNumber} not found`);
    }

    const meter = await this.prisma.waterMeter.findFirst({
      where: {
        unitId: unit.id,
        status: WaterMeterStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: [{ installationDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (!meter) {
      throw new NotFoundException(
        `Unit ${unitNumber} has no active water meter`,
      );
    }
    return { unit, meter };
  }

  /**
   * Creates draft reading records for every active unit with an active
   * meter. Lectura inicial = lectura final del periodo calendario inmediato
   * anterior (o initialReading del medidor si no hay).
   * Idempotente: si ya existe DRAFT/CAPTURED, resincroniza previousReading.
   */
  async generateReadingRecords(periodId: string, userId: string) {
    const period = await this.findOne(periodId);

    const units = await this.prisma.residentialUnit.findMany({
      where: {
        residentialComplexId: period.residentialComplexId,
        status: ResidentialUnitStatus.ACTIVE,
        deletedAt: null,
      },
    });

    const errors: BulkProcessErrorDto[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const unit of units) {
      try {
        const meter = await this.prisma.waterMeter.findFirst({
          where: {
            unitId: unit.id,
            status: WaterMeterStatus.ACTIVE,
            deletedAt: null,
          },
          orderBy: [{ installationDate: 'desc' }, { createdAt: 'desc' }],
        });
        if (!meter) {
          errors.push({
            unitNumber: unit.unitNumber,
            code: 'NO_ACTIVE_METER',
            message: `Unit ${unit.unitNumber} has no active water meter`,
          });
          continue;
        }

        const previousReading = await this.resolveInheritedPreviousReading(
          period,
          unit.id,
          meter,
        );

        const existing = await this.prisma.waterReading.findUnique({
          where: {
            billingPeriodId_unitId: {
              billingPeriodId: periodId,
              unitId: unit.id,
            },
          },
        });

        if (existing) {
          if (existing.status === WaterReadingStatus.CANCELLED) {
            skipped += 1;
            continue;
          }
          if (
            existing.status === WaterReadingStatus.DRAFT ||
            existing.status === WaterReadingStatus.CAPTURED
          ) {
            const currentWasSynced = toDecimal(existing.currentReading).eq(
              toDecimal(existing.previousReading),
            );
            await this.prisma.waterReading.update({
              where: { id: existing.id },
              data: {
                waterMeterId: meter.id,
                previousReading,
                ...(currentWasSynced ? { currentReading: previousReading } : {}),
                updatedBy: userId,
              },
            });
            updated += 1;
          } else {
            skipped += 1;
          }
          continue;
        }

        await this.prisma.waterReading.create({
          data: {
            billingPeriodId: periodId,
            unitId: unit.id,
            waterMeterId: meter.id,
            previousReading,
            currentReading: previousReading,
            status: WaterReadingStatus.DRAFT,
            createdBy: userId,
          },
        });
        created += 1;
      } catch (error: any) {
        errors.push({
          unitNumber: unit.unitNumber,
          code: 'GENERATE_ERROR',
          message: error?.message ?? 'Unknown error generating reading record',
        });
      }
    }

    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: periodId,
      action: 'WATER_PERIOD_GENERATE_READING_RECORDS',
      newData: { created, updated, skipped, failed: errors.length },
    });

    return {
      ...bulkResponse(units.length, created + updated, errors),
      summary: {
        total: units.length,
        processed: created + updated,
        created,
        updated,
        skipped,
        failed: errors.length,
      },
    };
  }

  /**
   * Resincroniza previousReading en lecturas DRAFT/CAPTURED del periodo
   * desde la lectura final del periodo calendario inmediato anterior.
   */
  async syncInheritedPreviousReadings(
    period: {
      id: string;
      residentialComplexId: string;
      billingYear: number;
      billingMonth: number;
    },
    userId: string,
  ) {
    const readings = await this.prisma.waterReading.findMany({
      where: {
        billingPeriodId: period.id,
        status: {
          in: [WaterReadingStatus.DRAFT, WaterReadingStatus.CAPTURED],
        },
      },
      include: { waterMeter: true },
    });

    let updated = 0;
    for (const reading of readings) {
      const meter =
        reading.waterMeter ??
        (await this.prisma.waterMeter.findFirst({
          where: {
            unitId: reading.unitId,
            status: WaterMeterStatus.ACTIVE,
            deletedAt: null,
          },
          orderBy: [{ installationDate: 'desc' }, { createdAt: 'desc' }],
        }));
      if (!meter) continue;

      const previousReading = await this.resolveInheritedPreviousReading(
        period,
        reading.unitId,
        meter,
      );
      if (toDecimal(reading.previousReading).eq(previousReading)) {
        continue;
      }

      const currentWasSynced = toDecimal(reading.currentReading).eq(
        toDecimal(reading.previousReading),
      );
      await this.prisma.waterReading.update({
        where: { id: reading.id },
        data: {
          previousReading,
          ...(currentWasSynced ? { currentReading: previousReading } : {}),
          updatedBy: userId,
        },
      });
      updated += 1;
    }
    return { updated };
  }

  /** Mes calendario inmediato anterior (p. ej. 2026-06 → 2026-05). */
  private immediatePreviousYearMonth(billingYear: number, billingMonth: number) {
    if (billingMonth <= 1) {
      return { billingYear: billingYear - 1, billingMonth: 12 };
    }
    return { billingYear, billingMonth: billingMonth - 1 };
  }

  /**
   * Lectura inicial heredada: currentReading del periodo inmediato anterior
   * para la misma vivienda; si no hay, initialReading del medidor.
   */
  private async resolveInheritedPreviousReading(
    period: {
      residentialComplexId: string;
      billingYear: number;
      billingMonth: number;
    },
    unitId: string,
    meter: { id: string; initialReading: Decimal },
  ): Promise<Decimal> {
    const prev = this.immediatePreviousYearMonth(
      period.billingYear,
      period.billingMonth,
    );
    const previousPeriod = await this.prisma.waterBillingPeriod.findUnique({
      where: {
        residentialComplexId_billingYear_billingMonth: {
          residentialComplexId: period.residentialComplexId,
          billingYear: prev.billingYear,
          billingMonth: prev.billingMonth,
        },
      },
    });
    if (!previousPeriod) {
      return toDecimal(meter.initialReading);
    }

    const lastReading = await this.prisma.waterReading.findFirst({
      where: {
        billingPeriodId: previousPeriod.id,
        unitId,
        status: { not: WaterReadingStatus.CANCELLED },
      },
    });
    return lastReading
      ? toDecimal(lastReading.currentReading)
      : toDecimal(meter.initialReading);
  }

  /**
   * En periodos abiertos, fuerza el tarifario de facturación = última vigencia cargada.
   * Periodos CLOSED/CANCELLED no se modifican.
   */
  private async ensurePeriodUsesLatestTariff(
    period: Awaited<ReturnType<WaterPeriodsService['findOne']>>,
    userId: string,
  ) {
    if (
      period.status === WaterBillingPeriodStatus.CLOSED ||
      period.status === WaterBillingPeriodStatus.CANCELLED
    ) {
      return period;
    }

    const latest = await this.waterTariffsService.findLatestForBilling(
      period.residentialComplexId,
    );
    if (!latest) return period;
    if (period.tariffId === latest.id) return period;

    await this.prisma.waterBillingPeriod.update({
      where: { id: period.id },
      data: { tariffId: latest.id, updatedBy: userId },
    });

    return this.findOne(period.id);
  }

  private async ensureWaterChargeType(residentialComplexId: string, userId: string) {
    const existing = await this.prisma.chargeType.findFirst({
      where: { residentialComplexId, category: ChargeCategory.WATER, isSystem: true },
    });
    if (existing) return existing;

    return this.prisma.chargeType.create({
      data: {
        residentialComplexId,
        code: 'WATER',
        name: 'Water consumption',
        category: ChargeCategory.WATER,
        isRecurring: true,
        isSystem: true,
        affectsBalance: true,
        createdBy: userId,
      },
    });
  }

  /**
   * Guarda el recibo CEA en el periodo, calcula el prorrateo:
   *   (monto recibo − suma pagos individuales por m³ − costo servicio × N) / N
   * aplica macroDifferencePrice + priceService a cada lectura y ejecuta calculate().
   * N = viviendas activas del condominio (p. ej. 90 en Hydra).
   */
  async applyCeaProration(
    periodId: string,
    dto: ApplyCeaProrationDto,
    userId: string,
  ) {
    let period = await this.findOne(periodId);
    if (
      period.status === WaterBillingPeriodStatus.CLOSED ||
      period.status === WaterBillingPeriodStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot apply CEA proration on a CLOSED or CANCELLED period',
      );
    }

    period = await this.ensurePeriodUsesLatestTariff(period, userId);

    if (!period.tariffId || !period.tariff) {
      throw new BadRequestException(
        'No hay tarifario de cálculo (última vigencia cargada) para este complejo',
      );
    }
    if (!period.tariff.tiers.length) {
      throw new BadRequestException(
        'Assigned tariff has no m3 rows configured. ' +
          'Re-import the CEA lookup JSON before applying proration.',
      );
    }

    const ceaBill = roundToMoney(
      toDecimal(dto.ceaBillTotalCost, 'ceaBillTotalCost'),
    );
    const priceService = roundToMoney(
      dto.priceService
        ? toDecimal(dto.priceService, 'priceService')
        : toDecimal('0'),
    );

    await this.prisma.waterBillingPeriod.update({
      where: { id: periodId },
      data: {
        ceaBillTotalCost: ceaBill,
        ...(dto.macrometerM3FromBill !== undefined
          ? {
              macrometerM3FromBill: toDecimal(
                dto.macrometerM3FromBill,
                'macrometerM3FromBill',
              ),
            }
          : {}),
        ...(dto.physicalMacrometerM3 !== undefined
          ? {
              physicalMacrometerM3: toDecimal(
                dto.physicalMacrometerM3,
                'physicalMacrometerM3',
              ),
            }
          : {}),
        updatedBy: userId,
      },
    });

    const readings = await this.prisma.waterReading.findMany({
      where: {
        billingPeriodId: periodId,
        status: { not: WaterReadingStatus.CANCELLED },
      },
      include: { unit: true },
    });
    if (readings.length === 0) {
      throw new BadRequestException(
        'No water readings found for this period. Load readings first.',
      );
    }

    const activeUnits = await this.prisma.residentialUnit.count({
      where: {
        residentialComplexId: period.residentialComplexId,
        status: ResidentialUnitStatus.ACTIVE,
        deletedAt: null,
      },
    });
    // Denominador del prorrateo: viviendas del condominio (p. ej. 90 Hydra).
    const unitsForProration =
      activeUnits > 0 ? activeUnits : readings.length;

    const tariffInput = this.waterTariffsService.toCalculatorInput(period.tariff);
    let sumIndividualM3Payments = new Decimal(0);

    for (const reading of readings) {
      const consumption = roundToMoney(
        toDecimal(reading.currentReading).minus(toDecimal(reading.previousReading)),
      );
      const result = this.calculator.calculate(
        {
          consumptionM3: moneyString(consumption),
          macroDifferencePrice: '0.00',
          manualAdjustment: moneyString(reading.manualAdjustment ?? 0),
          reserveFund: moneyString(reading.reserveFundAmount ?? 0),
        },
        tariffInput,
      );
      // Pago individual por m³ = monto de tarifa (sin macro).
      const waterAmount = roundToMoney(
        toDecimal(result.total)
          .minus(toDecimal(result.macroAdjustment))
          .minus(toDecimal(result.manualAdjustment))
          .minus(toDecimal(result.reserveFund)),
      );
      sumIndividualM3Payments = sumIndividualM3Payments.plus(waterAmount);
    }

    const uncoveredAmount = roundToMoney(
      ceaBill
        .minus(sumIndividualM3Payments)
        .minus(priceService.times(unitsForProration)),
    );
    // Si el prorrateo resulta negativo, se asigna cero (no hay faltante a repartir).
    const macroPerUnit = uncoveredAmount.lt(0)
      ? roundToMoney(toDecimal('0'))
      : roundToMoney(uncoveredAmount.div(unitsForProration));

    for (const reading of readings) {
      await this.prisma.waterReading.update({
        where: { id: reading.id },
        data: {
          macroDifferencePrice: macroPerUnit,
          serviceFeeAmount: priceService,
          updatedBy: userId,
        },
      });
    }

    const calculateResult = await this.calculate(periodId, userId);
    const report = await this.getReport(periodId);

    const totalServiceCost = roundToMoney(
      priceService.times(unitsForProration),
    );
    const proration = {
      ceaBillTotalCost: moneyString(ceaBill),
      sumIndividualM3Payments: moneyString(sumIndividualM3Payments),
      totalServiceCost: moneyString(totalServiceCost),
      uncoveredAmount: moneyString(uncoveredAmount),
      units: unitsForProration,
      readingsCount: readings.length,
      macroDifferencePricePerUnit: moneyString(macroPerUnit),
      priceService: moneyString(priceService),
      formula:
        `(${moneyString(ceaBill)} - ${moneyString(sumIndividualM3Payments)} - ${moneyString(priceService)} * ${unitsForProration}) / ${unitsForProration}`,
    };

    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: periodId,
      action: 'WATER_PERIOD_APPLY_CEA_PRORATION',
      newData: proration,
    });

    return {
      proration,
      calculate: calculateResult,
      report,
    };
  }

  /**
   * Runs the water billing calculator over every non-cancelled reading in
   * the period and upserts the matching WATER UnitCharge (unique per
   * waterReadingId, so re-running is idempotent and never duplicates).
   */
  async calculate(periodId: string, userId: string) {
    let period = await this.findOne(periodId);
    period = await this.ensurePeriodUsesLatestTariff(period, userId);

    if (!period.tariffId || !period.tariff) {
      throw new BadRequestException(
        'No hay tarifario de cálculo (última vigencia cargada) para este complejo',
      );
    }
    if (!period.tariff.tiers.length) {
      throw new BadRequestException(
        'Assigned tariff has no m3 rows configured. ' +
          'Re-import the CEA lookup JSON (POST /water-tariffs/from-lookup-json) ' +
          'and ensure this period points to that tariff before calculating.',
      );
    }

    const readings = await this.prisma.waterReading.findMany({
      where: { billingPeriodId: periodId, status: { not: WaterReadingStatus.CANCELLED } },
      include: { unit: true },
    });

    const chargeType = await this.ensureWaterChargeType(period.residentialComplexId, userId);
    const matchingBillingPeriod = await this.prisma.billingPeriod.findFirst({
      where: {
        residentialComplexId: period.residentialComplexId,
        year: period.billingYear,
        month: period.billingMonth,
      },
    });

    const tariffInput = this.waterTariffsService.toCalculatorInput(period.tariff);

    const errors: BulkProcessErrorDto[] = [];
    let processed = 0;

    for (const reading of readings) {
      try {
        const consumption = roundToMoney(
          toDecimal(reading.currentReading).minus(toDecimal(reading.previousReading)),
        );
        const serviceFee = roundToMoney(toDecimal(reading.serviceFeeAmount ?? 0));

        const result = this.calculator.calculate(
          {
            consumptionM3: moneyString(consumption),
            macroDifferencePrice: moneyString(reading.macroDifferencePrice),
            manualAdjustment: moneyString(reading.manualAdjustment),
            reserveFund: moneyString(reading.reserveFundAmount),
          },
          tariffInput,
        );

        // result.total = agua (tarifa) + macro (MXN) + manual + reserva
        const waterAndAdjustments = toDecimal(result.total);
        const waterAmount = roundToMoney(
          waterAndAdjustments
            .minus(toDecimal(result.macroAdjustment))
            .minus(toDecimal(result.manualAdjustment))
            .minus(toDecimal(result.reserveFund)),
        );
        const finalAmount = roundToMoney(waterAndAdjustments.plus(serviceFee));

        await this.prisma.waterReading.update({
          where: { id: reading.id },
          data: {
            consumptionM3: consumption,
            adjustedConsumptionM3: roundToMoney(
              toDecimal(result.adjustedConsumption),
            ),
            baseAmount: roundToMoney(toDecimal(result.baseCharge)),
            calculatedAmount: waterAmount,
            serviceFeeAmount: serviceFee,
            finalAmount,
            status: WaterReadingStatus.CALCULATED,
            updatedBy: userId,
          },
        });

        const movementType =
          finalAmount.lt(0) ? ChargeMovementType.CREDIT : ChargeMovementType.DEBIT;
        const amount = finalAmount.abs();

        const existingCharge = await this.prisma.unitCharge.findUnique({
          where: { waterReadingId: reading.id },
        });

        if (existingCharge) {
          await this.prisma.unitCharge.update({
            where: { id: existingCharge.id },
            data: {
              amount,
              movementType,
              description: `Water consumption - ${period.name}`,
              updatedBy: userId,
            },
          });
        } else {
          await this.prisma.unitCharge.create({
            data: {
              unitId: reading.unitId,
              billingPeriodId: matchingBillingPeriod?.id,
              chargeTypeId: chargeType.id,
              waterReadingId: reading.id,
              description: `Water consumption - ${period.name}`,
              amount,
              movementType,
              dueDate: matchingBillingPeriod?.dueDate,
              status: UnitChargeStatus.PENDING,
              source: UnitChargeSource.WATER_READING,
              createdBy: userId,
            },
          });
        }

        processed += 1;
      } catch (error: any) {
        errors.push({
          unitNumber: reading.unit.unitNumber,
          code: 'CALCULATE_ERROR',
          message: error?.message ?? 'Unknown error calculating reading',
        });
      }
    }

    if (!errors.length) {
      await this.prisma.waterBillingPeriod.update({
        where: { id: periodId },
        data: { status: WaterBillingPeriodStatus.CALCULATED, updatedBy: userId },
      });
    }

    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: periodId,
      action: 'WATER_PERIOD_CALCULATE',
      newData: { processed, failed: errors.length },
    });

    return bulkResponse(readings.length, processed, errors);
  }

  async close(periodId: string, userId: string) {
    const period = await this.findOne(periodId);
    if (period.status !== WaterBillingPeriodStatus.CALCULATED) {
      throw new BadRequestException('Only calculated periods can be closed');
    }

    const updated = await this.prisma.waterBillingPeriod.update({
      where: { id: periodId },
      data: {
        status: WaterBillingPeriodStatus.CLOSED,
        closedAt: new Date(),
        closedBy: userId,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: periodId,
      action: 'WATER_PERIOD_CLOSE',
    });

    return updated;
  }

  async reopen(periodId: string, userId: string) {
    const period = await this.findOne(periodId);
    if (period.status !== WaterBillingPeriodStatus.CLOSED) {
      throw new BadRequestException('Only closed periods can be reopened');
    }

    const updated = await this.prisma.waterBillingPeriod.update({
      where: { id: periodId },
      data: {
        status: WaterBillingPeriodStatus.CALCULATED,
        closedAt: null,
        closedBy: null,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'WaterBillingPeriod',
      entityId: periodId,
      action: 'WATER_PERIOD_REOPEN',
    });

    return updated;
  }
}

function roundToMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
