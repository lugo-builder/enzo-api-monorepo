import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { moneyString, paginate, toDecimal } from '../hydra-shared/money.util';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentFilterDto } from './dto/payment-filter.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePaymentDto, userId: string) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { id: dto.unitId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    if (dto.bankTransactionId) {
      const bankTransaction = await this.prisma.bankTransaction.findUnique({
        where: { id: dto.bankTransactionId },
      });
      if (!bankTransaction) {
        throw new NotFoundException('Bank transaction not found');
      }
    }

    const amount = toDecimal(dto.amount, 'amount');
    if (amount.lte(0)) {
      throw new BadRequestException('Payment amount must be positive');
    }

    const payment = await this.prisma.payment.create({
      data: {
        unitId: dto.unitId,
        bankTransactionId: dto.bankTransactionId,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        amount,
        unappliedAmount: amount,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        notes: dto.notes,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'Payment',
      entityId: payment.id,
      action: 'PAYMENT_CREATE',
      newData: { ...dto, amount: moneyString(amount) },
    });

    return this.serialize(payment);
  }

  async findAll(query: PaymentFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.PaymentWhereInput = {};
    if (query.unitId) where.unitId = query.unitId;
    if (query.status) where.status = query.status;
    if (query.bankTransactionId) where.bankTransactionId = query.bankTransactionId;

    const [totalRecords, data] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { paymentDate: 'desc' },
        include: { paymentApplications: { where: { reversedAt: null } } },
      }),
    ]);
    return { totalRecords, data: data.map((p) => this.serialize(p)) };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        paymentApplications: true,
        bankTransaction: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.serialize(payment);
  }

  async confirm(id: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be confirmed');
    }
    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.CONFIRMED, updatedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'Payment',
      entityId: id,
      action: 'PAYMENT_CONFIRM',
    });
    return this.serialize(updated);
  }

  async cancel(id: string, reason: string | undefined, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { paymentApplications: { where: { reversedAt: null } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.paymentApplications.length > 0) {
      throw new BadRequestException(
        'Payment has active applications; reverse them before cancelling',
      );
    }
    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.REVERSED
    ) {
      throw new BadRequestException('Payment already cancelled or reversed');
    }
    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
        updatedBy: userId,
      },
    });
    await this.auditService.log({
      userId,
      entityType: 'Payment',
      entityId: id,
      action: 'PAYMENT_CANCEL',
      metadata: { reason },
    });
    return this.serialize(updated);
  }

  private serialize(payment: any) {
    return {
      ...payment,
      amount: moneyString(payment.amount),
      unappliedAmount: moneyString(payment.unappliedAmount),
      paymentApplications: payment.paymentApplications?.map((a: any) => ({
        ...a,
        amount: moneyString(a.amount),
      })),
    };
  }
}
