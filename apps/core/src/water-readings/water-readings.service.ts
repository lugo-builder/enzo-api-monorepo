import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WaterBillingPeriodStatus,
  WaterReadingCalculationMode,
  WaterReadingStatus,
} from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { paginate, toDecimal } from '../hydra-shared/money.util';
import { UpdateWaterReadingDto } from './dto/update-water-reading.dto';
import { WaterReadingFilterDto } from './dto/water-reading-filter.dto';

@Injectable()
export class WaterReadingsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: WaterReadingFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.WaterReadingWhereInput = {};
    if (query.billingPeriodId) where.billingPeriodId = query.billingPeriodId;
    if (query.unitId) where.unitId = query.unitId;
    if (query.status) where.status = query.status;

    const [totalRecords, data] = await Promise.all([
      this.prisma.waterReading.count({ where }),
      this.prisma.waterReading.findMany({
        where,
        skip,
        take,
        include: { unit: true, waterMeter: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { totalRecords, data };
  }

  async findOne(id: string) {
    const reading = await this.prisma.waterReading.findUnique({
      where: { id },
      include: {
        unit: true,
        waterMeter: true,
        billingPeriod: true,
        unitCharges: true,
      },
    });
    if (!reading) throw new NotFoundException('Water reading not found');
    return reading;
  }

  async update(id: string, dto: UpdateWaterReadingDto, userId: string) {
    const reading = await this.findOne(id);

    if (reading.billingPeriod?.status === WaterBillingPeriodStatus.CLOSED) {
      throw new ConflictException(
        'Cannot modify readings on a CLOSED water billing period; reopen first',
      );
    }

    if (
      reading.status === WaterReadingStatus.CANCELLED
    ) {
      throw new BadRequestException('Cancelled reading cannot be edited');
    }

    const mode =
      dto.calculationMode ??
      reading.calculationMode ??
      WaterReadingCalculationMode.ACTUAL;

    const previous = dto.previousReading
      ? toDecimal(dto.previousReading)
      : toDecimal(reading.previousReading);
    const current = dto.currentReading
      ? toDecimal(dto.currentReading)
      : toDecimal(reading.currentReading);

    if (
      current.lt(previous) &&
      mode !== WaterReadingCalculationMode.METER_REPLACEMENT
    ) {
      throw new BadRequestException(
        'currentReading cannot be lower than previousReading unless calculationMode is METER_REPLACEMENT',
      );
    }

    const updated = await this.prisma.waterReading.update({
      where: { id },
      data: {
        currentReading: dto.currentReading ? current : undefined,
        previousReading: dto.previousReading ? previous : undefined,
        macroDifferencePrice: dto.macroDifferencePrice
          ? toDecimal(dto.macroDifferencePrice)
          : undefined,
        manualAdjustment: dto.manualAdjustment
          ? toDecimal(dto.manualAdjustment)
          : undefined,
        reserveFundAmount: dto.reserveFundAmount
          ? toDecimal(dto.reserveFundAmount)
          : undefined,
        calculationMode: dto.calculationMode,
        notes: dto.notes,
        status: WaterReadingStatus.CAPTURED,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'WaterReading',
      entityId: id,
      action: 'WATER_READING_UPDATE',
      previousData: {
        previousReading: String(reading.previousReading),
        currentReading: String(reading.currentReading),
      },
      newData: { ...dto },
    });

    return updated;
  }
}
