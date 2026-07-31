import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WaterMeterStatus } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import {
  BulkProcessErrorDto,
  bulkResponse,
} from '../hydra-shared/bulk-process-response.dto';
import { paginate, toDecimal } from '../hydra-shared/money.util';
import { CreateWaterMeterDto } from './dto/create-water-meter.dto';
import {
  ImportWaterMetersJsonDto,
  WaterMeterJsonRowDto,
} from './dto/import-water-meters-json.dto';
import { ReplaceWaterMeterDto } from './dto/replace-water-meter.dto';
import { UpdateWaterMeterDto } from './dto/update-water-meter.dto';
import { WaterMeterFilterDto } from './dto/water-meter-filter.dto';

@Injectable()
export class WaterMetersService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Alta masiva idempotente de medidores desde JSON.
   * Acepta `meters` o el arreglo `readings` del archivo de lecturas.
   */
  async importFromJson(dto: ImportWaterMetersJsonDto, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: dto.residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) {
      throw new NotFoundException('ResidentialComplex not found');
    }

    const rows = this.normalizeImportRows(dto);
    if (!rows.length) {
      throw new BadRequestException(
        'Provide at least one row in meters[] or readings[]',
      );
    }

    const errors: BulkProcessErrorDto[] = [];
    let created = 0;
    let skipped = 0;
    const seenUnits = new Set<string>();
    const seenSerials = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const serial = (row.serialNumber ?? row.meterSerial)?.trim();
        if (!serial) {
          throw new BadRequestException(
            'serialNumber or meterSerial is required',
          );
        }
        if (!row.unitNumber?.trim()) {
          throw new BadRequestException('unitNumber is required');
        }

        const unitKey = row.unitNumber.trim();
        if (seenUnits.has(unitKey)) {
          throw new BadRequestException(`Duplicate unitNumber ${unitKey}`);
        }
        if (seenSerials.has(serial)) {
          throw new BadRequestException(`Duplicate serial ${serial}`);
        }
        seenUnits.add(unitKey);
        seenSerials.add(serial);

        const unit = await this.prisma.residentialUnit.findFirst({
          where: {
            residentialComplexId: dto.residentialComplexId,
            unitNumber: unitKey,
            deletedAt: null,
          },
        });
        if (!unit) {
          throw new NotFoundException(
            `Unit ${unitKey} not found in this residential complex`,
          );
        }

        const serialElsewhere = await this.prisma.waterMeter.findFirst({
          where: {
            serialNumber: serial,
            deletedAt: null,
            unit: { residentialComplexId: dto.residentialComplexId },
            NOT: { unitId: unit.id },
          },
          include: { unit: true },
        });
        if (serialElsewhere) {
          throw new BadRequestException(
            `Serial ${serial} already registered on unit ${serialElsewhere.unit.unitNumber}`,
          );
        }

        const existingOnUnit = await this.prisma.waterMeter.findFirst({
          where: {
            unitId: unit.id,
            status: WaterMeterStatus.ACTIVE,
            deletedAt: null,
          },
          orderBy: [{ installationDate: 'desc' }, { createdAt: 'desc' }],
        });

        const initialReading =
          row.initialReading ??
          (row as WaterMeterJsonRowDto & { previousReading?: string })
            .previousReading;

        if (existingOnUnit) {
          if (existingOnUnit.serialNumber === serial) {
            if (initialReading) {
              await this.prisma.waterMeter.update({
                where: { id: existingOnUnit.id },
                data: {
                  initialReading: toDecimal(initialReading, 'initialReading'),
                  updatedBy: userId,
                },
              });
            }
            skipped += 1;
            continue;
          }
          throw new BadRequestException(
            `Unit ${unitKey} already has active meter ${existingOnUnit.serialNumber}; use replace endpoint to change folio`,
          );
        }

        await this.prisma.waterMeter.create({
          data: {
            unitId: unit.id,
            serialNumber: serial,
            initialReading: initialReading
              ? toDecimal(initialReading, 'initialReading')
              : undefined,
            status: WaterMeterStatus.ACTIVE,
            createdBy: userId,
          },
        });
        created += 1;
      } catch (error: any) {
        errors.push({
          row: rowNum,
          unitNumber: row.unitNumber,
          code: 'IMPORT_METER_ERROR',
          message: error?.message ?? 'Unknown error importing water meter',
        });
      }
    }

    await this.auditService.log({
      userId,
      entityType: 'ResidentialComplex',
      entityId: dto.residentialComplexId,
      action: 'WATER_METERS_IMPORT_JSON',
      newData: {
        created,
        skipped,
        failed: errors.length,
        total: rows.length,
      },
    });

    return {
      ...bulkResponse(rows.length, created, errors),
      summary: {
        total: rows.length,
        processed: created,
        created,
        skipped,
        failed: errors.length,
      },
    };
  }

  private normalizeImportRows(
    dto: ImportWaterMetersJsonDto,
  ): Array<
    WaterMeterJsonRowDto & { previousReading?: string; initialReading?: string }
  > {
    if (dto.meters?.length) {
      return dto.meters;
    }
    if (dto.readings?.length) {
      return dto.readings.map((r: any) => ({
        unitNumber: r.unitNumber,
        serialNumber: r.serialNumber ?? r.meterSerial,
        meterSerial: r.meterSerial,
        initialReading: r.initialReading ?? r.previousReading,
        previousReading: r.previousReading,
      }));
    }
    return [];
  }

  async create(dto: CreateWaterMeterDto, userId: string) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { id: dto.unitId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    const meter = await this.prisma.waterMeter.create({
      data: {
        unitId: dto.unitId,
        serialNumber: dto.serialNumber,
        installationDate: dto.installationDate ? new Date(dto.installationDate) : undefined,
        initialReading: dto.initialReading ? toDecimal(dto.initialReading) : undefined,
        status: dto.status,
        notes: dto.notes,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'WaterMeter',
      entityId: meter.id,
      action: 'WATER_METER_CREATE',
      newData: { ...dto },
    });

    return meter;
  }

  async findAll(query: WaterMeterFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.WaterMeterWhereInput = {};
    if (query.unitId) where.unitId = query.unitId;
    if (query.serialNumber) where.serialNumber = { contains: query.serialNumber };
    if (query.status) where.status = query.status;

    const [totalRecords, data] = await Promise.all([
      this.prisma.waterMeter.count({ where }),
      this.prisma.waterMeter.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { totalRecords, data };
  }

  async findOne(id: string) {
    const meter = await this.prisma.waterMeter.findFirst({
      where: { id, deletedAt: null },
    });
    if (!meter) throw new NotFoundException('Water meter not found');
    return meter;
  }

  async update(id: string, dto: UpdateWaterMeterDto, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.waterMeter.update({
      where: { id },
      data: {
        ...dto,
        installationDate: dto.installationDate ? new Date(dto.installationDate) : undefined,
        initialReading: dto.initialReading ? toDecimal(dto.initialReading) : undefined,
        updatedBy: userId,
      },
    });
    await this.auditService.log({
      userId,
      entityType: 'WaterMeter',
      entityId: id,
      action: 'WATER_METER_UPDATE',
      newData: { ...dto },
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.waterMeter.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'WaterMeter',
      entityId: id,
      action: 'WATER_METER_DELETE',
    });
    return { success: true };
  }

  async getHistory(unitId: string) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { id: unitId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    return this.prisma.waterMeter.findMany({
      where: { unitId },
      orderBy: [{ installationDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Replaces the currently active meter for a unit: marks the old meter as
   * REPLACED (with removalDate) and creates a new ACTIVE meter, atomically.
   */
  async replace(unitId: string, dto: ReplaceWaterMeterDto, userId: string) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { id: unitId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    const currentMeter = await this.prisma.waterMeter.findFirst({
      where: { unitId, status: WaterMeterStatus.ACTIVE, deletedAt: null },
      orderBy: { installationDate: 'desc' },
    });

    const duplicateSerial = await this.prisma.waterMeter.findFirst({
      where: { unitId, serialNumber: dto.newSerialNumber, deletedAt: null },
    });
    if (duplicateSerial) {
      throw new BadRequestException('Serial number already registered for this unit');
    }

    return this.prisma.$transaction(async (tx) => {
      const replacementDate = dto.replacementDate ? new Date(dto.replacementDate) : new Date();

      let oldMeter = null;
      if (currentMeter) {
        oldMeter = await tx.waterMeter.update({
          where: { id: currentMeter.id },
          data: {
            status: WaterMeterStatus.REPLACED,
            removalDate: replacementDate,
            updatedBy: userId,
          },
        });
      }

      const newMeter = await tx.waterMeter.create({
        data: {
          unitId,
          serialNumber: dto.newSerialNumber,
          installationDate: replacementDate,
          initialReading: dto.initialReading ? toDecimal(dto.initialReading) : undefined,
          status: WaterMeterStatus.ACTIVE,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      await this.auditService.log({
        userId,
        entityType: 'WaterMeter',
        entityId: newMeter.id,
        action: 'WATER_METER_REPLACE',
        previousData: currentMeter ? { id: currentMeter.id, serialNumber: currentMeter.serialNumber } : null,
        newData: { id: newMeter.id, serialNumber: newMeter.serialNumber },
        metadata: { finalReading: dto.finalReading },
      });

      return { oldMeter, newMeter };
    });
  }
}
