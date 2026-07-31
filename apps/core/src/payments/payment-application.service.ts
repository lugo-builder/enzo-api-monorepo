import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  UnitChargeStatus,
  BankTransactionStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { DatabaseService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { toDecimal, moneyString } from '../hydra-shared/money.util';
import { UnitBalanceService } from './unit-balance.service';

@Injectable()
export class PaymentApplicationService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly balanceService: UnitBalanceService,
    private readonly auditService: AuditService,
  ) {}

  async apply(params: {
    paymentId: string;
    applications: { unitChargeId: string; amount: string }[];
    userId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: params.paymentId },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (
        ![PaymentStatus.CONFIRMED, PaymentStatus.PARTIALLY_APPLIED].includes(
          payment.status as any,
        ) &&
        payment.status !== PaymentStatus.PENDING
      ) {
        if (
          payment.status === PaymentStatus.APPLIED ||
          payment.status === PaymentStatus.CANCELLED ||
          payment.status === PaymentStatus.REVERSED
        ) {
          throw new ConflictException('Payment cannot receive new applications');
        }
      }
      if (
        payment.status !== PaymentStatus.CONFIRMED &&
        payment.status !== PaymentStatus.PARTIALLY_APPLIED &&
        payment.status !== PaymentStatus.PENDING
      ) {
        throw new BadRequestException('Only confirmed payments can be applied');
      }
      // Require CONFIRMED or allow PENDING-> need confirm first
      if (payment.status === PaymentStatus.PENDING) {
        throw new BadRequestException('Payment must be confirmed before apply');
      }

      let unapplied = toDecimal(payment.unappliedAmount);
      const results = [];

      for (const app of params.applications) {
        const amount = toDecimal(app.amount, 'amount');
        if (amount.lte(0)) {
          throw new BadRequestException('Application amount must be positive');
        }
        if (amount.gt(unapplied)) {
          throw new BadRequestException('Application exceeds payment unapplied amount');
        }

        const charge = await tx.unitCharge.findUnique({
          where: { id: app.unitChargeId },
          include: { paymentApplications: { where: { reversedAt: null } } },
        });
        if (!charge) throw new NotFoundException(`Charge ${app.unitChargeId} not found`);
        if (charge.billingPeriodId) {
          const period = await tx.billingPeriod.findUnique({
            where: { id: charge.billingPeriodId },
          });
          if (period?.status === 'CLOSED') {
            throw new ConflictException(
              'Cannot apply payments to charges on a CLOSED billing period; reopen first',
            );
          }
        }
        if (charge.unitId !== payment.unitId) {
          throw new BadRequestException('Charge does not belong to payment unit');
        }
        if (
          [UnitChargeStatus.CANCELLED, UnitChargeStatus.PAID, UnitChargeStatus.WAIVED].includes(
            charge.status as any,
          )
        ) {
          throw new ConflictException('Charge is not payable');
        }

        let remaining = toDecimal(charge.amount);
        for (const a of charge.paymentApplications) {
          remaining = remaining.minus(toDecimal(a.amount));
        }
        if (amount.gt(remaining)) {
          throw new BadRequestException('Application exceeds charge remaining balance');
        }

        const existing = await tx.paymentApplication.findUnique({
          where: {
            paymentId_unitChargeId: {
              paymentId: payment.id,
              unitChargeId: charge.id,
            },
          },
        });
        if (existing && !existing.reversedAt) {
          throw new ConflictException('Payment already applied to this charge');
        }

        let application;
        if (existing && existing.reversedAt) {
          application = await tx.paymentApplication.update({
            where: { id: existing.id },
            data: {
              amount,
              appliedAt: new Date(),
              createdBy: params.userId,
              reversedAt: null,
              reversedBy: null,
              reversalReason: null,
              updatedBy: params.userId,
            },
          });
        } else {
          application = await tx.paymentApplication.create({
            data: {
              paymentId: payment.id,
              unitChargeId: charge.id,
              amount,
              createdBy: params.userId,
            },
          });
        }

        unapplied = unapplied.minus(amount);
        const newRemaining = remaining.minus(amount);
        await tx.unitCharge.update({
          where: { id: charge.id },
          data: {
            status: newRemaining.lte(0)
              ? UnitChargeStatus.PAID
              : UnitChargeStatus.PARTIALLY_PAID,
            updatedBy: params.userId,
          },
        });

        results.push(application);
      }

      const newStatus =
        unapplied.lte(0) ? PaymentStatus.APPLIED : PaymentStatus.PARTIALLY_APPLIED;

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          unappliedAmount: unapplied,
          status: newStatus,
          updatedBy: params.userId,
        },
      });

      if (payment.bankTransactionId) {
        await tx.bankTransaction.update({
          where: { id: payment.bankTransactionId },
          data: {
            status:
              unapplied.lte(0)
                ? BankTransactionStatus.APPLIED
                : BankTransactionStatus.PARTIALLY_APPLIED,
            matchedUnitId: payment.unitId,
            updatedBy: params.userId,
          },
        });
      }

      await this.auditService.log({
        userId: params.userId,
        entityType: 'Payment',
        entityId: payment.id,
        action: 'PAYMENT_APPLY',
        newData: {
          applications: params.applications,
          unappliedAmount: moneyString(unapplied),
        },
      });

      return { payment: updatedPayment, applications: results };
    });
  }

  async autoApply(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PENDING) {
      throw new BadRequestException('Payment must be confirmed before auto-apply');
    }

    const charges = await this.prisma.unitCharge.findMany({
      where: {
        unitId: payment.unitId,
        status: {
          in: [UnitChargeStatus.PENDING, UnitChargeStatus.PARTIALLY_PAID],
        },
        movementType: 'DEBIT',
      },
      include: {
        chargeType: true,
        paymentApplications: { where: { reversedAt: null } },
      },
      orderBy: [{ dueDate: 'asc' }, { chargeDate: 'asc' }],
    });

    // Configurable priority: past-due first, then PENALTY/SURCHARGE, then current
    const now = new Date();
    const scored = charges.map((c) => {
      let remaining = toDecimal(c.amount);
      for (const a of c.paymentApplications) remaining = remaining.minus(toDecimal(a.amount));
      const isPastDue = c.dueDate && c.dueDate < now ? 0 : 1;
      const isPenalty =
        c.chargeType.category === 'PENALTY' || c.chargeType.category === 'SURCHARGE'
          ? 0
          : 1;
      return { charge: c, remaining, isPastDue, isPenalty };
    });
    scored.sort((a, b) => a.isPastDue - b.isPastDue || a.isPenalty - b.isPenalty);

    let available = toDecimal(payment.unappliedAmount);
    const applications: { unitChargeId: string; amount: string }[] = [];
    for (const item of scored) {
      if (available.lte(0) || item.remaining.lte(0)) continue;
      const applyAmt = Decimal.min(available, item.remaining);
      applications.push({
        unitChargeId: item.charge.id,
        amount: moneyString(applyAmt),
      });
      available = available.minus(applyAmt);
    }

    if (!applications.length) {
      return { payment, applications: [], message: 'No payable charges found' };
    }
    return this.apply({ paymentId, applications, userId });
  }

  async reverseApplication(params: {
    paymentId: string;
    unitChargeId: string;
    reason: string;
    userId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const app = await tx.paymentApplication.findUnique({
        where: {
          paymentId_unitChargeId: {
            paymentId: params.paymentId,
            unitChargeId: params.unitChargeId,
          },
        },
      });
      if (!app || app.reversedAt) {
        throw new NotFoundException('Active application not found');
      }

      const chargeForPeriod = await tx.unitCharge.findUnique({
        where: { id: params.unitChargeId },
      });
      if (chargeForPeriod?.billingPeriodId) {
        const period = await tx.billingPeriod.findUnique({
          where: { id: chargeForPeriod.billingPeriodId },
        });
        if (period?.status === 'CLOSED') {
          throw new ConflictException(
            'Cannot reverse applications on a CLOSED billing period; reopen first',
          );
        }
      }

      await tx.paymentApplication.update({
        where: { id: app.id },
        data: {
          reversedAt: new Date(),
          reversedBy: params.userId,
          reversalReason: params.reason,
          updatedBy: params.userId,
        },
      });

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: params.paymentId },
      });
      const newUnapplied = toDecimal(payment.unappliedAmount).plus(toDecimal(app.amount));
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          unappliedAmount: newUnapplied,
          status:
            newUnapplied.eq(toDecimal(payment.amount))
              ? PaymentStatus.CONFIRMED
              : PaymentStatus.PARTIALLY_APPLIED,
          updatedBy: params.userId,
        },
      });

      const remaining = await this.balanceService.remainingChargeAmount(
        params.unitChargeId,
        tx,
      );
      // After reverse, remaining increases — recompute
      const charge = await tx.unitCharge.findUniqueOrThrow({
        where: { id: params.unitChargeId },
        include: { paymentApplications: { where: { reversedAt: null } } },
      });
      let rem = toDecimal(charge.amount);
      for (const a of charge.paymentApplications) {
        if (a.id === app.id) continue;
        rem = rem.minus(toDecimal(a.amount));
      }
      await tx.unitCharge.update({
        where: { id: charge.id },
        data: {
          status: rem.eq(toDecimal(charge.amount))
            ? UnitChargeStatus.PENDING
            : rem.lte(0)
              ? UnitChargeStatus.PAID
              : UnitChargeStatus.PARTIALLY_PAID,
          updatedBy: params.userId,
        },
      });

      await this.auditService.log({
        userId: params.userId,
        entityType: 'PaymentApplication',
        entityId: app.id,
        action: 'PAYMENT_APPLICATION_REVERSE',
        previousData: { amount: moneyString(app.amount) },
        metadata: { reason: params.reason },
      });

      return { reversed: true };
    });
  }
}
