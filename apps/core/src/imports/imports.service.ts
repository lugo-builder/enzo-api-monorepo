import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BankTransactionSource,
  ChargeCategory,
  ImportBatchStatus,
  ImportBatchType,
  Prisma,
  UnitChargeSource,
  UnitChargeStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import * as XLSX from 'xlsx';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import {
  BulkProcessErrorDto,
  bulkResponse,
} from '../hydra-shared/bulk-process-response.dto';
import { paginate, toDecimal } from '../hydra-shared/money.util';
import { ImportFilterDto } from './dto/import-filter.dto';
import { ImportValidationService } from './import-validation.service';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
    private readonly validationService: ImportValidationService,
  ) {}

  private parseRows(buffer: Buffer): Record<string, any>[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false });
    } catch {
      throw new BadRequestException('Unable to parse uploaded file');
    }
  }

  async upload(
    residentialComplexId: string,
    type: ImportBatchType,
    file: Express.Multer.File,
    userId: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    const rows = this.parseRows(file.buffer);
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    return this.createBatch({
      residentialComplexId,
      type,
      rows,
      filename: file.originalname,
      checksum,
      userId,
      source: 'FILE',
    });
  }

  /**
   * Crea un ImportBatch desde un arreglo JSON (mismo flujo validate → preview → confirm).
   */
  async uploadFromJson(
    residentialComplexId: string,
    type: ImportBatchType,
    rows: Record<string, any>[],
    userId: string,
    filename?: string,
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('rows must be a non-empty array');
    }
    const normalized = rows.map((row) => ({ ...row }));
    const payload = JSON.stringify(normalized);
    const checksum = crypto.createHash('sha256').update(payload).digest('hex');
    return this.createBatch({
      residentialComplexId,
      type,
      rows: normalized,
      filename: filename ?? `json-import-${type.toLowerCase()}.json`,
      checksum,
      userId,
      source: 'JSON',
    });
  }

  private async createBatch(params: {
    residentialComplexId: string;
    type: ImportBatchType;
    rows: Record<string, any>[];
    filename: string;
    checksum: string;
    userId: string;
    source: 'FILE' | 'JSON';
  }) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: params.residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');

    const batch = await this.prisma.importBatch.create({
      data: {
        residentialComplexId: params.residentialComplexId,
        type: params.type,
        filename: params.filename,
        checksum: params.checksum,
        status: ImportBatchStatus.UPLOADED,
        totalRows: params.rows.length,
        payload: params.rows as Prisma.InputJsonValue,
        previewData: params.rows as Prisma.InputJsonValue,
        createdBy: params.userId,
      },
    });

    await this.auditService.log({
      userId: params.userId,
      entityType: 'ImportBatch',
      entityId: batch.id,
      action: 'IMPORT_UPLOAD',
      newData: {
        type: params.type,
        filename: params.filename,
        totalRows: params.rows.length,
        source: params.source,
      },
    });

    return batch;
  }

  async findAll(query: ImportFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.ImportBatchWhereInput = {};
    if (query.residentialComplexId) where.residentialComplexId = query.residentialComplexId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [totalRecords, data] = await Promise.all([
      this.prisma.importBatch.count({ where }),
      this.prisma.importBatch.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    ]);
    return { totalRecords, data };
  }

  async findOne(id: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Import batch not found');
    return batch;
  }

  async validate(id: string, userId: string) {
    const batch = await this.findOne(id);
    const rows = (batch.previewData as Record<string, any>[]) ?? [];

    const summary = await this.validationService.validate(batch.residentialComplexId, batch.type, rows);

    const updated = await this.prisma.importBatch.update({
      where: { id },
      data: {
        status:
          summary.validRows === 0
            ? ImportBatchStatus.FAILED
            : ImportBatchStatus.VALIDATED,
        validRows: summary.validRows,
        invalidRows: summary.invalidRows,
        errorReport: summary.errorReport as unknown as Prisma.InputJsonValue,
        previewData: summary.results as unknown as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'ImportBatch',
      entityId: id,
      action: 'IMPORT_VALIDATE',
      newData: { validRows: summary.validRows, invalidRows: summary.invalidRows },
    });

    return updated;
  }

  async preview(id: string) {
    const batch = await this.findOne(id);
    return {
      batch,
      rows: batch.previewData ?? [],
      errors: batch.errorReport ?? [],
    };
  }

  async confirm(id: string, userId: string) {
    const batch = await this.findOne(id);
    if (batch.status !== ImportBatchStatus.VALIDATED) {
      throw new BadRequestException('Only validated import batches can be confirmed');
    }

    const rows = (batch.previewData as any[]) as { row: number; valid: boolean; data: any }[];
    const validRows = rows.filter((r) => r.valid);

    await this.prisma.importBatch.update({
      where: { id },
      data: { status: ImportBatchStatus.PROCESSING, updatedBy: userId },
    });

    const errors: BulkProcessErrorDto[] = [];
    let processed = 0;

    for (const item of validRows) {
      try {
        await this.processRow(batch.residentialComplexId, batch.type, item.data, userId);
        processed += 1;
      } catch (error: any) {
        errors.push({
          row: item.row,
          unitNumber: item.data?.unitNumber,
          code: 'PROCESS_ROW_ERROR',
          message: error?.message ?? 'Unknown error processing row',
        });
      }
    }

    const finalStatus =
      errors.length === 0
        ? ImportBatchStatus.PROCESSED
        : processed > 0
          ? ImportBatchStatus.PARTIAL
          : ImportBatchStatus.FAILED;

    const updated = await this.prisma.importBatch.update({
      where: { id },
      data: {
        status: finalStatus,
        processedRows: processed,
        errorReport: errors.length
          ? (errors as unknown as Prisma.InputJsonValue)
          : (batch.errorReport as any),
        processedAt: new Date(),
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'ImportBatch',
      entityId: id,
      action: 'IMPORT_CONFIRM',
      newData: { processed, failed: errors.length },
    });

    return { ...bulkResponse(validRows.length, processed, errors), batch: updated };
  }

  private async processRow(
    residentialComplexId: string,
    type: ImportBatchType,
    row: Record<string, any>,
    userId: string,
  ) {
    switch (type) {
      case ImportBatchType.OPENING_BALANCES:
        return this.processOpeningBalance(residentialComplexId, row, userId);
      case ImportBatchType.BANK_TRANSACTIONS:
        return this.processBankTransaction(residentialComplexId, row, userId);
      case ImportBatchType.WATER_READINGS:
        return this.processWaterReading(residentialComplexId, row, userId);
      case ImportBatchType.RESIDENTS:
        return this.processResident(residentialComplexId, row, userId);
      case ImportBatchType.CHARGES:
        return this.processCharge(residentialComplexId, row, userId);
      case ImportBatchType.WATER_TARIFF:
      case ImportBatchType.WATER_CONSUMPTION_REPORT:
      case ImportBatchType.PAYMENT_REPORT:
        throw new BadRequestException(
          `Type ${type} is processed via dedicated water/payment endpoints`,
        );
      default:
        throw new BadRequestException(`Unsupported import type: ${type}`);
    }
  }

  private async ensureOpeningBalanceChargeType(residentialComplexId: string, userId: string) {
    const existing = await this.prisma.chargeType.findFirst({
      where: { residentialComplexId, category: ChargeCategory.OPENING_BALANCE, isSystem: true },
    });
    if (existing) return existing;
    return this.prisma.chargeType.create({
      data: {
        residentialComplexId,
        code: 'OPENING_BALANCE',
        name: 'Opening balance',
        category: ChargeCategory.OPENING_BALANCE,
        isSystem: true,
        affectsBalance: true,
        createdBy: userId,
      },
    });
  }

  /** Opening-balance rows create a SYSTEM-sourced UnitCharge under the OPENING_BALANCE charge type. */
  private async processOpeningBalance(
    residentialComplexId: string,
    row: Record<string, any>,
    userId: string,
  ) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { residentialComplexId, unitNumber: String(row.unitNumber), deletedAt: null },
    });
    if (!unit) throw new NotFoundException(`Unit ${row.unitNumber} not found`);

    const chargeType = await this.ensureOpeningBalanceChargeType(residentialComplexId, userId);

    await this.prisma.unitCharge.create({
      data: {
        unitId: unit.id,
        chargeTypeId: chargeType.id,
        description: row.description ?? 'Opening balance',
        amount: toDecimal(String(row.amount)),
        chargeDate: row.chargeDate ? new Date(row.chargeDate) : new Date(),
        status: UnitChargeStatus.PENDING,
        source: UnitChargeSource.SYSTEM,
        createdBy: userId,
      },
    });
  }

  private async processBankTransaction(
    residentialComplexId: string,
    row: Record<string, any>,
    userId: string,
  ) {
    await this.prisma.bankTransaction.create({
      data: {
        residentialComplexId,
        transactionDate: new Date(row.transactionDate),
        amount: toDecimal(String(row.amount)),
        bankReference: row.bankReference,
        concept: row.concept,
        senderName: row.senderName,
        rawDescription: row.rawDescription ?? row.concept,
        source: BankTransactionSource.XLSX,
        createdBy: userId,
      },
    });
  }

  private async processWaterReading(
    residentialComplexId: string,
    row: Record<string, any>,
    userId: string,
  ) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { residentialComplexId, unitNumber: String(row.unitNumber), deletedAt: null },
    });
    if (!unit) throw new NotFoundException(`Unit ${row.unitNumber} not found`);

    if (!row.billingPeriodId) {
      throw new BadRequestException('billingPeriodId is required to import a water reading');
    }

    const existing = await this.prisma.waterReading.findUnique({
      where: {
        billingPeriodId_unitId: { billingPeriodId: row.billingPeriodId, unitId: unit.id },
      },
    });
    const currentReading = toDecimal(String(row.currentReading));
    const previousReading = row.previousReading
      ? toDecimal(String(row.previousReading))
      : (existing ? toDecimal(existing.previousReading) : toDecimal('0'));

    if (existing) {
      await this.prisma.waterReading.update({
        where: { id: existing.id },
        data: { currentReading, previousReading, updatedBy: userId, status: 'CAPTURED' },
      });
    } else {
      await this.prisma.waterReading.create({
        data: {
          billingPeriodId: row.billingPeriodId,
          unitId: unit.id,
          currentReading,
          previousReading,
          status: 'CAPTURED',
          createdBy: userId,
        },
      });
    }
  }

  private async processResident(
    residentialComplexId: string,
    row: Record<string, any>,
    userId: string,
  ) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { residentialComplexId, unitNumber: String(row.unitNumber), deletedAt: null },
    });
    if (!unit) throw new NotFoundException(`Unit ${row.unitNumber} not found`);

    const fullName = row.fullName ?? [row.firstName, row.lastName].filter(Boolean).join(' ');
    const resident = await this.prisma.resident.create({
      data: {
        firstName: row.firstName ?? fullName,
        lastName: row.lastName,
        fullName,
        email: row.email,
        phone: row.phone,
        createdBy: userId,
      },
    });

    await this.prisma.unitResident.create({
      data: {
        unitId: unit.id,
        residentId: resident.id,
        isPrimary: true,
        isPaymentResponsible: true,
        createdBy: userId,
      },
    });
  }

  private async processCharge(
    residentialComplexId: string,
    row: Record<string, any>,
    userId: string,
  ) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { residentialComplexId, unitNumber: String(row.unitNumber), deletedAt: null },
    });
    if (!unit) throw new NotFoundException(`Unit ${row.unitNumber} not found`);

    const chargeType = await this.prisma.chargeType.findUnique({
      where: {
        residentialComplexId_code: { residentialComplexId, code: String(row.chargeTypeCode) },
      },
    });
    if (!chargeType) throw new NotFoundException(`Charge type ${row.chargeTypeCode} not found`);

    await this.prisma.unitCharge.create({
      data: {
        unitId: unit.id,
        chargeTypeId: chargeType.id,
        description: row.description ?? chargeType.name,
        amount: toDecimal(String(row.amount)),
        chargeDate: row.chargeDate ? new Date(row.chargeDate) : new Date(),
        status: UnitChargeStatus.PENDING,
        source: UnitChargeSource.IMPORT,
        createdBy: userId,
      },
    });
  }
}
