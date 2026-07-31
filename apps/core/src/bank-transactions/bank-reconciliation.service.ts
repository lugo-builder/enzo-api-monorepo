import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BankTransactionStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';

import { DatabaseService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { moneyString, toDecimal } from '../hydra-shared/money.util';

/**
 * Detects unit-number hints inside bank concept/description text, e.g.
 * "Hydra 90", "Hydra #90", "CASA 90", "Casa#90", "UNIDAD 90".
 */
const UNIT_HINT_PATTERNS = [
  /hydra\s*#?\s*(\d+)/i,
  /casa\s*#?\s*(\d+)/i,
  /unidad\s*#?\s*(\d+)/i,
  /depto\.?\s*#?\s*(\d+)/i,
  /apt\.?\s*#?\s*(\d+)/i,
];

export interface MatchSuggestion {
  unitId: string;
  unitNumber: string;
  confidence: number;
  reasons: string[];
}

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  private extractUnitHints(transaction: {
    concept?: string | null;
    rawDescription?: string | null;
    senderName?: string | null;
  }): string[] {
    const text = [transaction.concept, transaction.rawDescription, transaction.senderName]
      .filter(Boolean)
      .join(' ');
    const hints = new Set<string>();
    for (const pattern of UNIT_HINT_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) hints.add(match[1]);
    }
    return [...hints];
  }

  async suggestMatch(transactionId: string): Promise<MatchSuggestion[]> {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new NotFoundException('Bank transaction not found');

    const unitHints = this.extractUnitHints(transaction);
    const amount = toDecimal(transaction.amount);

    const candidateUnits = await this.prisma.residentialUnit.findMany({
      where: {
        residentialComplexId: transaction.residentialComplexId,
        deletedAt: null,
        ...(unitHints.length ? { unitNumber: { in: unitHints } } : {}),
      },
    });

    const suggestions: MatchSuggestion[] = [];
    for (const unit of candidateUnits) {
      const reasons: string[] = [];
      let confidence = 0;

      if (unitHints.includes(unit.unitNumber)) {
        confidence += 0.7;
        reasons.push(`Unit number "${unit.unitNumber}" found in transaction text`);
      }

      const pendingCharges = await this.prisma.unitCharge.findMany({
        where: {
          unitId: unit.id,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        include: { paymentApplications: { where: { reversedAt: null } } },
      });
      const hasMatchingAmount = pendingCharges.some((charge) => {
        const remaining = toDecimal(charge.amount).minus(
          charge.paymentApplications.reduce(
            (sum, a) => sum.plus(toDecimal(a.amount)),
            toDecimal('0'),
          ),
        );
        return remaining.eq(amount);
      });
      if (hasMatchingAmount) {
        confidence += 0.3;
        reasons.push(`Amount ${moneyString(amount)} matches an outstanding charge`);
      }

      if (confidence > 0) {
        suggestions.push({
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          confidence: Math.min(confidence, 1),
          reasons,
        });
      }
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);

    if (suggestions.length && transaction.status === BankTransactionStatus.UNMATCHED) {
      await this.prisma.bankTransaction.update({
        where: { id: transactionId },
        data: { status: BankTransactionStatus.SUGGESTED },
      });
    }

    return suggestions;
  }

  /** Confirms a suggested (or manual) match: creates a confirmed Payment tied to the bank transaction. */
  async match(transactionId: string, unitId: string, userId: string) {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new NotFoundException('Bank transaction not found');
    const nonMatchableStatuses: BankTransactionStatus[] = [
      BankTransactionStatus.APPLIED,
      BankTransactionStatus.IGNORED,
      BankTransactionStatus.DUPLICATE,
      BankTransactionStatus.REVERSED,
    ];
    if (nonMatchableStatuses.includes(transaction.status)) {
      throw new BadRequestException(`Transaction cannot be matched from status ${transaction.status}`);
    }

    const unit = await this.prisma.residentialUnit.findFirst({
      where: { id: unitId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          unitId,
          bankTransactionId: transactionId,
          paymentDate: transaction.transactionDate,
          amount: transaction.amount,
          unappliedAmount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          reference: transaction.bankReference,
          status: PaymentStatus.CONFIRMED,
          createdBy: userId,
        },
      });

      const updatedTransaction = await tx.bankTransaction.update({
        where: { id: transactionId },
        data: {
          matchedUnitId: unitId,
          status: BankTransactionStatus.SUGGESTED,
          updatedBy: userId,
        },
      });

      await this.auditService.log({
        userId,
        entityType: 'BankTransaction',
        entityId: transactionId,
        action: 'BANK_TRANSACTION_MATCH',
        newData: { unitId, paymentId: payment.id },
      });

      return { transaction: updatedTransaction, payment };
    });
  }

  async ignore(transactionId: string, reason: string | undefined, userId: string) {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new NotFoundException('Bank transaction not found');
    if (transaction.status === BankTransactionStatus.APPLIED) {
      throw new BadRequestException('Cannot ignore a fully applied transaction');
    }

    const updated = await this.prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        status: BankTransactionStatus.IGNORED,
        notes: reason ?? transaction.notes,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'BankTransaction',
      entityId: transactionId,
      action: 'BANK_TRANSACTION_IGNORE',
      metadata: { reason },
    });

    return updated;
  }

  async reverse(transactionId: string, reason: string, userId: string) {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
      include: {
        payments: { include: { paymentApplications: { where: { reversedAt: null } } } },
      },
    });
    if (!transaction) throw new NotFoundException('Bank transaction not found');

    const activePayments = transaction.payments.filter(
      (p) => p.status !== PaymentStatus.CANCELLED && p.status !== PaymentStatus.REVERSED,
    );
    for (const payment of activePayments) {
      if (payment.paymentApplications.length > 0) {
        throw new BadRequestException(
          'Reverse all payment applications for this transaction before reversing it',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for (const payment of activePayments) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REVERSED,
            cancelledAt: new Date(),
            cancelledBy: userId,
            cancellationReason: reason,
            updatedBy: userId,
          },
        });
      }

      const updated = await tx.bankTransaction.update({
        where: { id: transactionId },
        data: {
          status: BankTransactionStatus.REVERSED,
          matchedUnitId: null,
          updatedBy: userId,
        },
      });

      await this.auditService.log({
        userId,
        entityType: 'BankTransaction',
        entityId: transactionId,
        action: 'BANK_TRANSACTION_REVERSE',
        metadata: { reason },
      });

      return updated;
    });
  }

  async reconciliationSummary(residentialComplexId: string) {
    const transactions = await this.prisma.bankTransaction.findMany({
      where: { residentialComplexId },
    });

    const summary: Record<string, { count: number; totalAmount: string }> = {};
    for (const status of Object.values(BankTransactionStatus)) {
      summary[status] = { count: 0, totalAmount: '0.00' };
    }

    const totals: Record<string, ReturnType<typeof toDecimal>> = {};
    for (const tx of transactions) {
      const key = tx.status;
      totals[key] = (totals[key] ?? toDecimal('0')).plus(toDecimal(tx.amount));
      summary[key].count += 1;
    }
    for (const key of Object.keys(totals)) {
      summary[key].totalAmount = moneyString(totals[key]);
    }

    return {
      residentialComplexId,
      totalTransactions: transactions.length,
      byStatus: summary,
    };
  }
}
