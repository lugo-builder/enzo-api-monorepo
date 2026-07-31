import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingPeriodStatus, Prisma, UnitChargeStatus } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { moneyString, paginate, toDecimal } from '../hydra-shared/money.util';
import { BillingPeriodFilterDto } from './dto/billing-period-filter.dto';
import { CreateBillingPeriodDto } from './dto/create-billing-period.dto';
import { UpdateBillingPeriodDto } from './dto/update-billing-period.dto';

@Injectable()
export class BillingPeriodsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateBillingPeriodDto, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: dto.residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');

    const existing = await this.prisma.billingPeriod.findUnique({
      where: {
        residentialComplexId_year_month: {
          residentialComplexId: dto.residentialComplexId,
          year: dto.year,
          month: dto.month,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A billing period already exists for this residentialComplex/year/month',
      );
    }

    const period = await this.prisma.billingPeriod.create({
      data: {
        residentialComplexId: dto.residentialComplexId,
        year: dto.year,
        month: dto.month,
        name: dto.name,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'BillingPeriod',
      entityId: period.id,
      action: 'BILLING_PERIOD_CREATE',
      newData: { ...dto },
    });

    return period;
  }

  async findAll(query: BillingPeriodFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.BillingPeriodWhereInput = {};
    if (query.residentialComplexId) where.residentialComplexId = query.residentialComplexId;
    if (query.status) where.status = query.status;
    if (query.year) where.year = query.year;
    if (query.month) where.month = query.month;

    const [totalRecords, data] = await Promise.all([
      this.prisma.billingPeriod.count({ where }),
      this.prisma.billingPeriod.findMany({
        where,
        skip,
        take,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
    ]);
    return { totalRecords, data };
  }

  async findOne(id: string) {
    const period = await this.prisma.billingPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Billing period not found');
    return period;
  }

  async update(id: string, dto: UpdateBillingPeriodDto, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.billingPeriod.update({
      where: { id },
      data: {
        name: dto.name,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        updatedBy: userId,
      },
    });
    await this.auditService.log({
      userId,
      entityType: 'BillingPeriod',
      entityId: id,
      action: 'BILLING_PERIOD_UPDATE',
      newData: { ...dto },
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.billingPeriod.update({
      where: { id },
      data: { status: BillingPeriodStatus.CANCELLED, updatedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'BillingPeriod',
      entityId: id,
      action: 'BILLING_PERIOD_CANCEL',
    });
    return updated;
  }

  async close(id: string, userId: string) {
    const period = await this.findOne(id);
    if (
      period.status !== BillingPeriodStatus.GENERATED &&
      period.status !== BillingPeriodStatus.OPEN
    ) {
      throw new BadRequestException('Only generated/open periods can be closed');
    }
    const updated = await this.prisma.billingPeriod.update({
      where: { id },
      data: { status: BillingPeriodStatus.CLOSED, closedAt: new Date(), updatedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'BillingPeriod',
      entityId: id,
      action: 'BILLING_PERIOD_CLOSE',
    });
    return updated;
  }

  async reopen(id: string, userId: string) {
    const period = await this.findOne(id);
    if (period.status !== BillingPeriodStatus.CLOSED) {
      throw new BadRequestException('Only closed periods can be reopened');
    }
    const updated = await this.prisma.billingPeriod.update({
      where: { id },
      data: { status: BillingPeriodStatus.OPEN, closedAt: null, updatedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'BillingPeriod',
      entityId: id,
      action: 'BILLING_PERIOD_REOPEN',
    });
    return updated;
  }

  async summary(id: string) {
    const period = await this.findOne(id);
    const charges = await this.prisma.unitCharge.findMany({
      where: { billingPeriodId: id, status: { not: UnitChargeStatus.CANCELLED } },
      include: { paymentApplications: { where: { reversedAt: null } } },
    });

    let totalCharged = toDecimal('0');
    let totalCollected = toDecimal('0');
    let totalPending = toDecimal('0');
    const unitsWithDebt = new Set<string>();

    for (const charge of charges) {
      const amount = toDecimal(charge.amount);
      const applied = charge.paymentApplications.reduce(
        (sum, a) => sum.plus(toDecimal(a.amount)),
        toDecimal('0'),
      );
      totalCharged = totalCharged.plus(amount);
      totalCollected = totalCollected.plus(applied);
      const remaining = amount.minus(applied);
      if (remaining.gt(0)) {
        totalPending = totalPending.plus(remaining);
        unitsWithDebt.add(charge.unitId);
      }
    }

    return {
      period,
      chargesCount: charges.length,
      unitsWithDebtCount: unitsWithDebt.size,
      totalCharged: moneyString(totalCharged),
      totalCollected: moneyString(totalCollected),
      totalPending: moneyString(totalPending),
    };
  }
}
