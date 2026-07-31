import { Injectable } from '@nestjs/common';
import { ChargeMovementType, Prisma, UnitChargeStatus, PaymentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { DatabaseService } from '@app/database';
import { moneyString, toDecimal } from '../hydra-shared/money.util';

export interface UnitBalanceResult {
  openingBalance: string;
  charges: string;
  credits: string;
  payments: string;
  unappliedPayments: string;
  closingBalance: string;
  pastDueBalance: string;
  currentBalance: string;
}

@Injectable()
export class UnitBalanceService {
  constructor(private readonly prisma: DatabaseService) {}

  async getBalance(
    unitId: string,
    asOf?: Date,
    openingFrom?: Date,
  ): Promise<UnitBalanceResult> {
    const chargeWhere: Prisma.UnitChargeWhereInput = {
      unitId,
      status: { notIn: [UnitChargeStatus.CANCELLED, UnitChargeStatus.DRAFT] },
      ...(asOf ? { chargeDate: { lte: asOf } } : {}),
      ...(openingFrom ? { chargeDate: { gte: openingFrom, ...(asOf ? { lte: asOf } : {}) } } : {}),
    };

    // Rebuild chargeWhere carefully when both dates exist
    if (openingFrom && asOf) {
      chargeWhere.chargeDate = { gte: openingFrom, lte: asOf };
    } else if (openingFrom) {
      chargeWhere.chargeDate = { gte: openingFrom };
    } else if (asOf) {
      chargeWhere.chargeDate = { lte: asOf };
    }

    const charges = await this.prisma.unitCharge.findMany({ where: chargeWhere });

    let debit = new Decimal(0);
    let credit = new Decimal(0);
    for (const c of charges) {
      if (!c.chargeTypeId) continue;
      const amt = toDecimal(c.amount);
      if (c.movementType === ChargeMovementType.DEBIT) debit = debit.plus(amt);
      else credit = credit.plus(amt);
    }

    const paymentWhere: Prisma.PaymentWhereInput = {
      unitId,
      status: {
        in: [
          PaymentStatus.CONFIRMED,
          PaymentStatus.PARTIALLY_APPLIED,
          PaymentStatus.APPLIED,
        ],
      },
      cancelledAt: null,
      ...(asOf ? { paymentDate: { lte: asOf } } : {}),
    };

    const payments = await this.prisma.payment.findMany({ where: paymentWhere });
    let paymentTotal = new Decimal(0);
    let unapplied = new Decimal(0);
    for (const p of payments) {
      const applied = toDecimal(p.amount).minus(toDecimal(p.unappliedAmount));
      paymentTotal = paymentTotal.plus(applied);
      unapplied = unapplied.plus(toDecimal(p.unappliedAmount));
    }

    const opening = openingFrom
      ? await this.balanceUntil(unitId, new Date(openingFrom.getTime() - 1))
      : new Decimal(0);

    const closing = opening.plus(debit).minus(credit).minus(paymentTotal);
    const current = asOf ? closing : await this.balanceUntil(unitId);

    const pastDue = await this.pastDue(unitId, asOf ?? new Date());

    return {
      openingBalance: moneyString(opening),
      charges: moneyString(debit),
      credits: moneyString(credit),
      payments: moneyString(paymentTotal),
      unappliedPayments: moneyString(unapplied),
      closingBalance: moneyString(closing),
      pastDueBalance: moneyString(pastDue),
      currentBalance: moneyString(current),
    };
  }

  /** Saldo pendiente = débitos - créditos - pagos aplicados (hasta fecha). */
  async balanceUntil(unitId: string, asOf?: Date): Promise<Decimal> {
    const chargeWhere: Prisma.UnitChargeWhereInput = {
      unitId,
      status: { notIn: [UnitChargeStatus.CANCELLED, UnitChargeStatus.DRAFT, UnitChargeStatus.WAIVED] },
      ...(asOf ? { chargeDate: { lte: asOf } } : {}),
    };
    const charges = await this.prisma.unitCharge.findMany({ where: chargeWhere });
    let balance = new Decimal(0);
    for (const c of charges) {
      const amt = toDecimal(c.amount);
      balance =
        c.movementType === ChargeMovementType.DEBIT
          ? balance.plus(amt)
          : balance.minus(amt);
    }

    const apps = await this.prisma.paymentApplication.findMany({
      where: {
        reversedAt: null,
        unitCharge: { unitId },
        ...(asOf ? { appliedAt: { lte: asOf } } : {}),
      },
    });
    for (const a of apps) {
      balance = balance.minus(toDecimal(a.amount));
    }
    return balance;
  }

  async pastDue(unitId: string, asOf: Date): Promise<Decimal> {
    const charges = await this.prisma.unitCharge.findMany({
      where: {
        unitId,
        movementType: ChargeMovementType.DEBIT,
        status: { in: [UnitChargeStatus.PENDING, UnitChargeStatus.PARTIALLY_PAID] },
        dueDate: { lt: asOf },
      },
      include: { paymentApplications: { where: { reversedAt: null } } },
    });
    let due = new Decimal(0);
    for (const c of charges) {
      let remaining = toDecimal(c.amount);
      for (const a of c.paymentApplications) {
        remaining = remaining.minus(toDecimal(a.amount));
      }
      if (remaining.gt(0)) due = due.plus(remaining);
    }
    return due;
  }

  async remainingChargeAmount(unitChargeId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const charge = await db.unitCharge.findUniqueOrThrow({
      where: { id: unitChargeId },
      include: { paymentApplications: { where: { reversedAt: null } } },
    });
    let remaining = toDecimal(charge.amount);
    if (charge.movementType === ChargeMovementType.CREDIT) {
      return new Decimal(0);
    }
    for (const a of charge.paymentApplications) {
      remaining = remaining.minus(toDecimal(a.amount));
    }
    return remaining;
  }
}
