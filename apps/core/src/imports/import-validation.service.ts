import { Injectable } from '@nestjs/common';
import { ImportBatchType } from '@prisma/client';

import { DatabaseService } from '@app/database';

import { BulkProcessErrorDto } from '../hydra-shared/bulk-process-response.dto';
import { toDecimal } from '../hydra-shared/money.util';

export interface RowValidationResult {
  row: number;
  valid: boolean;
  data: Record<string, any>;
  errors: string[];
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorReport: BulkProcessErrorDto[];
  results: RowValidationResult[];
}

@Injectable()
export class ImportValidationService {
  constructor(private readonly prisma: DatabaseService) {}

  async validate(
    residentialComplexId: string,
    type: ImportBatchType,
    rows: Record<string, any>[],
  ): Promise<ValidationSummary> {
    const results: RowValidationResult[] = [];
    const errorReport: BulkProcessErrorDto[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const row = rows[i];
      const errors = await this.validateRow(residentialComplexId, type, row);

      results.push({ row: rowNumber, valid: errors.length === 0, data: row, errors });
      if (errors.length) {
        errorReport.push({
          row: rowNumber,
          unitNumber: row.unitNumber,
          code: 'VALIDATION_ERROR',
          message: errors.join('; '),
        });
      }
    }

    const validRows = results.filter((r) => r.valid).length;
    return {
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      errorReport,
      results,
    };
  }

  private async validateRow(
    residentialComplexId: string,
    type: ImportBatchType,
    row: Record<string, any>,
  ): Promise<string[]> {
    switch (type) {
      case ImportBatchType.OPENING_BALANCES:
        return this.validateOpeningBalance(residentialComplexId, row);
      case ImportBatchType.BANK_TRANSACTIONS:
        return this.validateBankTransaction(row);
      case ImportBatchType.WATER_READINGS:
        return this.validateWaterReading(residentialComplexId, row);
      case ImportBatchType.RESIDENTS:
        return this.validateResident(residentialComplexId, row);
      case ImportBatchType.CHARGES:
        return this.validateCharge(residentialComplexId, row);
      case ImportBatchType.WATER_TARIFF:
      case ImportBatchType.WATER_CONSUMPTION_REPORT:
      case ImportBatchType.PAYMENT_REPORT:
        return [
          `Type ${type} is stored via dedicated endpoints; use /water-tariffs or /water-periods imports`,
        ];
      default:
        return [`Unsupported import type: ${type}`];
    }
  }

  private async findUnit(residentialComplexId: string, unitNumber: string) {
    if (!unitNumber) return null;
    return this.prisma.residentialUnit.findFirst({
      where: { residentialComplexId, unitNumber: String(unitNumber), deletedAt: null },
    });
  }

  private async validateOpeningBalance(
    residentialComplexId: string,
    row: Record<string, any>,
  ): Promise<string[]> {
    const errors: string[] = [];
    if (!row.unitNumber) errors.push('unitNumber is required');
    if (row.amount === undefined || row.amount === null || row.amount === '') {
      errors.push('amount is required');
    } else {
      try {
        toDecimal(String(row.amount));
      } catch {
        errors.push('amount must be a valid decimal number');
      }
    }
    if (row.unitNumber) {
      const unit = await this.findUnit(residentialComplexId, row.unitNumber);
      if (!unit) errors.push(`Unit ${row.unitNumber} not found in this residentialComplex`);
    }
    return errors;
  }

  private validateBankTransaction(row: Record<string, any>): string[] {
    const errors: string[] = [];
    if (!row.transactionDate) errors.push('transactionDate is required');
    else if (Number.isNaN(new Date(row.transactionDate).getTime())) {
      errors.push('transactionDate is not a valid date');
    }
    if (row.amount === undefined || row.amount === null || row.amount === '') {
      errors.push('amount is required');
    } else {
      try {
        toDecimal(String(row.amount));
      } catch {
        errors.push('amount must be a valid decimal number');
      }
    }
    return errors;
  }

  private async validateWaterReading(
    residentialComplexId: string,
    row: Record<string, any>,
  ): Promise<string[]> {
    const errors: string[] = [];
    if (!row.unitNumber) errors.push('unitNumber is required');
    if (row.currentReading === undefined || row.currentReading === null || row.currentReading === '') {
      errors.push('currentReading is required');
    } else {
      try {
        toDecimal(String(row.currentReading));
      } catch {
        errors.push('currentReading must be a valid decimal number');
      }
    }
    if (row.unitNumber) {
      const unit = await this.findUnit(residentialComplexId, row.unitNumber);
      if (!unit) errors.push(`Unit ${row.unitNumber} not found in this residentialComplex`);
    }
    return errors;
  }

  private async validateResident(
    residentialComplexId: string,
    row: Record<string, any>,
  ): Promise<string[]> {
    const errors: string[] = [];
    if (!row.unitNumber) errors.push('unitNumber is required');
    if (!row.fullName && !row.firstName) errors.push('fullName or firstName is required');
    if (row.unitNumber) {
      const unit = await this.findUnit(residentialComplexId, row.unitNumber);
      if (!unit) errors.push(`Unit ${row.unitNumber} not found in this residentialComplex`);
    }
    return errors;
  }

  private async validateCharge(
    residentialComplexId: string,
    row: Record<string, any>,
  ): Promise<string[]> {
    const errors: string[] = [];
    if (!row.unitNumber) errors.push('unitNumber is required');
    if (!row.chargeTypeCode) errors.push('chargeTypeCode is required');
    if (row.amount === undefined || row.amount === null || row.amount === '') {
      errors.push('amount is required');
    } else {
      try {
        toDecimal(String(row.amount));
      } catch {
        errors.push('amount must be a valid decimal number');
      }
    }
    if (row.unitNumber) {
      const unit = await this.findUnit(residentialComplexId, row.unitNumber);
      if (!unit) errors.push(`Unit ${row.unitNumber} not found in this residentialComplex`);
    }
    if (row.chargeTypeCode) {
      const chargeType = await this.prisma.chargeType.findUnique({
        where: { residentialComplexId_code: { residentialComplexId, code: String(row.chargeTypeCode) } },
      });
      if (!chargeType) errors.push(`Charge type ${row.chargeTypeCode} not found`);
    }
    return errors;
  }
}
