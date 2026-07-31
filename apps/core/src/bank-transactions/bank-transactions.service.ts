import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BankTransactionSource, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as XLSX from 'xlsx';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import {
  BulkProcessErrorDto,
  bulkResponse,
} from '../hydra-shared/bulk-process-response.dto';
import { moneyString, paginate, toDecimal } from '../hydra-shared/money.util';
import { BankTransactionFilterDto } from './dto/bank-transaction-filter.dto';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';

interface ImportRow {
  transactionDate?: string | number;
  postingDate?: string | number;
  amount?: string | number;
  concept?: string;
  senderName?: string;
  bankReference?: string;
  rawDescription?: string;
}

@Injectable()
export class BankTransactionsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  private serialize(transaction: any) {
    return { ...transaction, amount: moneyString(transaction.amount) };
  }

  async create(dto: CreateBankTransactionDto, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: dto.residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');

    const transaction = await this.prisma.bankTransaction.create({
      data: {
        residentialComplexId: dto.residentialComplexId,
        transactionDate: new Date(dto.transactionDate),
        postingDate: dto.postingDate ? new Date(dto.postingDate) : undefined,
        amount: toDecimal(dto.amount),
        currency: dto.currency,
        transactionType: dto.transactionType,
        bankReference: dto.bankReference,
        concept: dto.concept,
        senderName: dto.senderName,
        senderAccountMasked: dto.senderAccountMasked,
        rawDescription: dto.rawDescription,
        source: BankTransactionSource.MANUAL,
        notes: dto.notes,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'BankTransaction',
      entityId: transaction.id,
      action: 'BANK_TRANSACTION_CREATE',
      newData: { ...dto },
    });

    return this.serialize(transaction);
  }

  async findAll(query: BankTransactionFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.BankTransactionWhereInput = {};
    if (query.residentialComplexId) where.residentialComplexId = query.residentialComplexId;
    if (query.status) where.status = query.status;
    if (query.globalFilter) {
      where.OR = [
        { concept: { contains: query.globalFilter } },
        { senderName: { contains: query.globalFilter } },
        { bankReference: { contains: query.globalFilter } },
      ];
    }

    const [totalRecords, data] = await Promise.all([
      this.prisma.bankTransaction.count({ where }),
      this.prisma.bankTransaction.findMany({
        where,
        skip,
        take,
        orderBy: { transactionDate: 'desc' },
      }),
    ]);
    return { totalRecords, data: data.map((t) => this.serialize(t)) };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id },
      include: { matchedUnit: true, payments: true },
    });
    if (!transaction) throw new NotFoundException('Bank transaction not found');
    return this.serialize(transaction);
  }

  private hashRow(residentialComplexId: string, row: ImportRow, amount: string): string {
    const raw = `${residentialComplexId}|${row.transactionDate}|${amount}|${row.bankReference ?? ''}|${row.concept ?? ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Parses an uploaded xlsx/csv buffer and creates BankTransaction rows, skipping duplicates by content hash. */
  async importFromFile(residentialComplexId: string, buffer: Buffer, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');

    let rows: ImportRow[];
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { raw: false });
    } catch {
      throw new BadRequestException('Unable to parse uploaded file');
    }

    const errors: BulkProcessErrorDto[] = [];
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.transactionDate || row.amount === undefined || row.amount === null) {
          errors.push({
            row: i + 1,
            code: 'MISSING_FIELDS',
            message: 'transactionDate and amount are required',
          });
          continue;
        }

        const amount = toDecimal(String(row.amount));
        const sourceHash = this.hashRow(residentialComplexId, row, moneyString(amount));

        const duplicate = await this.prisma.bankTransaction.findFirst({
          where: { residentialComplexId, sourceHash },
        });
        if (duplicate) {
          skipped += 1;
          continue;
        }

        await this.prisma.bankTransaction.create({
          data: {
            residentialComplexId,
            transactionDate: new Date(row.transactionDate),
            postingDate: row.postingDate ? new Date(row.postingDate) : undefined,
            amount,
            bankReference: row.bankReference,
            concept: row.concept,
            senderName: row.senderName,
            rawDescription: row.rawDescription ?? row.concept,
            source: BankTransactionSource.XLSX,
            sourceHash,
            createdBy: userId,
          },
        });
        created += 1;
      } catch (error: any) {
        errors.push({
          row: i + 1,
          code: 'IMPORT_ROW_ERROR',
          message: error?.message ?? 'Unknown error importing row',
        });
      }
    }

    await this.auditService.log({
      userId,
      entityType: 'BankTransaction',
      entityId: residentialComplexId,
      action: 'BANK_TRANSACTION_IMPORT',
      newData: { created, skipped, failed: errors.length },
    });

    return { ...bulkResponse(rows.length, created, errors), skipped };
  }
}
