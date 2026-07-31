import { Injectable, NotFoundException } from '@nestjs/common';
import { ChargeMovementType, ResidentialUnitStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { DatabaseService } from '@app/database';

import { moneyString, toDecimal } from '../hydra-shared/money.util';
import { sortByUnitNumber } from '../hydra-shared/unit-order.util';
import { UnitBalanceService } from '../payments/unit-balance.service';

export interface AccountStatementLine {
  id: string;
  date: Date;
  description: string;
  amount: string;
}

export interface AccountStatement {
  unit: Record<string, unknown>;
  responsibleResident: Record<string, unknown> | null;
  period: Record<string, unknown> | null;
  openingBalance: string;
  charges: AccountStatementLine[];
  credits: AccountStatementLine[];
  payments: AccountStatementLine[];
  totalCharges: string;
  totalCredits: string;
  totalPayments: string;
  closingBalance: string;
  dueDate: string | null;
  status: string;
  comments: string[];
}

@Injectable()
export class AccountStatementService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly balanceService: UnitBalanceService,
  ) {}

  private monthRange(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { start, end };
  }

  async getUnitStatement(
    unitId: string,
    billingPeriodId?: string,
    year?: number,
    month?: number,
  ): Promise<AccountStatement> {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { id: unitId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    let periodStart: Date | undefined;
    let periodEnd: Date | undefined;
    let period: any = null;

    if (billingPeriodId) {
      period = await this.prisma.billingPeriod.findUnique({
        where: { id: billingPeriodId },
      });
      if (!period) throw new NotFoundException('Billing period not found');
      const range = this.monthRange(period.year, period.month);
      periodStart = range.start;
      periodEnd = range.end;
    } else if (year && month) {
      period = await this.prisma.billingPeriod.findFirst({
        where: {
          residentialComplexId: unit.residentialComplexId,
          year,
          month,
        },
      });
      const range = this.monthRange(year, month);
      periodStart = range.start;
      periodEnd = range.end;
    }

    const chargeWhere: any = {
      unitId,
      status: { not: 'CANCELLED' },
      ...(period?.id ? { billingPeriodId: period.id } : {}),
    };

    const charges = await this.prisma.unitCharge.findMany({
      where: { ...chargeWhere, movementType: ChargeMovementType.DEBIT },
      include: { chargeType: true },
      orderBy: { chargeDate: 'asc' },
    });
    const credits = await this.prisma.unitCharge.findMany({
      where: { ...chargeWhere, movementType: ChargeMovementType.CREDIT },
      include: { chargeType: true },
      orderBy: { chargeDate: 'asc' },
    });

    const payments = await this.prisma.payment.findMany({
      where: {
        unitId,
        cancelledAt: null,
        ...(periodStart && periodEnd
          ? { paymentDate: { gte: periodStart, lte: periodEnd } }
          : {}),
      },
      orderBy: { paymentDate: 'asc' },
    });

    const openingBalance = periodStart
      ? await this.balanceService.balanceUntil(
          unitId,
          new Date(periodStart.getTime() - 1),
        )
      : new Decimal(0);

    const sum = (items: { amount: any }[]) =>
      items.reduce(
        (acc, item) => acc.plus(toDecimal(item.amount)),
        new Decimal(0),
      );

    const totalCharges = sum(charges);
    const totalCredits = sum(credits);
    const totalPayments = sum(payments);
    const closingBalance = openingBalance
      .plus(totalCharges)
      .minus(totalCredits)
      .minus(totalPayments);

    const responsible = await this.prisma.unitResident.findFirst({
      where: {
        unitId,
        status: 'ACTIVE',
        isPaymentResponsible: true,
        endDate: null,
      },
      include: { resident: true },
    });

    const dueDate = period?.dueDate
      ? period.dueDate.toISOString().slice(0, 10)
      : null;
    const status = closingBalance.lte(0) ? 'PAID' : 'PENDING';
    const comments: string[] = [];
    if (unit.notes) comments.push(unit.notes);

    return {
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        displayName: unit.displayName,
        status: unit.status,
        serviceStatus: unit.serviceStatus,
      },
      responsibleResident: responsible?.resident
        ? {
            id: responsible.resident.id,
            fullName: responsible.resident.fullName,
            email: responsible.resident.email,
            phone: responsible.resident.phone,
          }
        : null,
      period: period
        ? {
            id: period.id,
            year: period.year,
            month: period.month,
            name: period.name,
            status: period.status,
          }
        : year && month
          ? { year, month }
          : null,
      openingBalance: moneyString(openingBalance),
      charges: charges.map((c) => ({
        id: c.id,
        date: c.chargeDate,
        description: c.description ?? c.chargeType.name,
        amount: moneyString(c.amount),
      })),
      credits: credits.map((c) => ({
        id: c.id,
        date: c.chargeDate,
        description: c.description ?? c.chargeType.name,
        amount: moneyString(c.amount),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        date: p.paymentDate,
        description: p.reference ?? 'Payment',
        amount: moneyString(p.amount),
      })),
      totalCharges: moneyString(totalCharges),
      totalCredits: moneyString(totalCredits),
      totalPayments: moneyString(totalPayments),
      closingBalance: moneyString(closingBalance),
      dueDate,
      status,
      comments,
    };
  }

  async getPeriodStatements(billingPeriodId: string): Promise<AccountStatement[]> {
    const period = await this.prisma.billingPeriod.findUnique({
      where: { id: billingPeriodId },
    });
    if (!period) throw new NotFoundException('Billing period not found');

    const units = sortByUnitNumber(
      await this.prisma.residentialUnit.findMany({
        where: {
          residentialComplexId: period.residentialComplexId,
          status: ResidentialUnitStatus.ACTIVE,
          deletedAt: null,
        },
      }),
      (u) => u.unitNumber,
    );

    const statements: AccountStatement[] = [];
    for (const unit of units) {
      statements.push(await this.getUnitStatement(unit.id, billingPeriodId));
    }
    return statements;
  }

  toCsvRows(statement: AccountStatement) {
    const unitNumber = String(statement.unit.unitNumber ?? '');
    const rows: Record<string, string>[] = [];
    for (const c of statement.charges) {
      rows.push({
        unitNumber,
        type: 'CHARGE',
        date: c.date.toISOString(),
        description: c.description,
        amount: c.amount,
      });
    }
    for (const c of statement.credits) {
      rows.push({
        unitNumber,
        type: 'CREDIT',
        date: c.date.toISOString(),
        description: c.description,
        amount: c.amount,
      });
    }
    for (const p of statement.payments) {
      rows.push({
        unitNumber,
        type: 'PAYMENT',
        date: p.date.toISOString(),
        description: p.description,
        amount: p.amount,
      });
    }
    rows.push({
      unitNumber,
      type: 'SUMMARY',
      date: '',
      description: 'closingBalance',
      amount: statement.closingBalance,
    });
    return rows;
  }
}
