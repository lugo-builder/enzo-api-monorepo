import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UnitResidentStatus } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { moneyString, paginate } from '../hydra-shared/money.util';
import { UnitBalanceService } from '../payments/unit-balance.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UnitFilterDto } from './dto/unit-filter.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
    private readonly balanceService: UnitBalanceService,
  ) {}

  async create(dto: CreateUnitDto, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: dto.residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');

    const unit = await this.prisma.residentialUnit.create({
      data: { ...dto, createdBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'ResidentialUnit',
      entityId: unit.id,
      action: 'UNIT_CREATE',
      newData: { ...dto },
    });
    return unit;
  }

  async findAll(query: UnitFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.ResidentialUnitWhereInput = {};
    if (query.residentialComplexId) where.residentialComplexId = query.residentialComplexId;
    if (query.unitNumber) where.unitNumber = { contains: query.unitNumber };
    if (query.status) where.status = query.status;
    if (query.serviceStatus) where.serviceStatus = query.serviceStatus;
    if (query.residentName) {
      where.unitResidents = {
        some: {
          status: UnitResidentStatus.ACTIVE,
          resident: { fullName: { contains: query.residentName } },
        },
      };
    }

    let data: any[];
    let totalRecords: number;

    if (query.hasDebt !== undefined) {
      // Debt is a computed value; fetch candidate units first, then filter in memory.
      const candidates = await this.prisma.residentialUnit.findMany({
        where,
        orderBy: [{ residentialComplexId: 'asc' }, { unitNumber: 'asc' }],
      });
      const withBalances = await Promise.all(
        candidates.map(async (unit) => {
          const balance = await this.balanceService.balanceUntil(unit.id);
          return { unit, hasDebt: balance.gt(0) };
        }),
      );
      const filtered = withBalances.filter((r) => r.hasDebt === query.hasDebt);
      totalRecords = filtered.length;
      data = filtered.slice(skip, skip + take).map((r) => r.unit);
    } else {
      [totalRecords, data] = await Promise.all([
        this.prisma.residentialUnit.count({ where }),
        this.prisma.residentialUnit.findMany({
          where,
          skip,
          take,
          orderBy: [{ residentialComplexId: 'asc' }, { unitNumber: 'asc' }],
        }),
      ]);
    }

    return { totalRecords, data };
  }

  async findOne(id: string) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { id, deletedAt: null },
      include: { residentialComplex: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async update(id: string, dto: UpdateUnitDto, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.residentialUnit.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'ResidentialUnit',
      entityId: id,
      action: 'UNIT_UPDATE',
      newData: { ...dto },
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.residentialUnit.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'ResidentialUnit',
      entityId: id,
      action: 'UNIT_DELETE',
    });
    return { success: true };
  }

  async getResidents(unitId: string) {
    await this.findOne(unitId);
    return this.prisma.unitResident.findMany({
      where: { unitId },
      include: { resident: true },
      orderBy: [{ status: 'asc' }, { isPrimary: 'desc' }, { startDate: 'asc' }],
    });
  }

  async getBalance(unitId: string, asOf?: string) {
    await this.findOne(unitId);
    return this.balanceService.getBalance(
      unitId,
      asOf ? new Date(asOf) : undefined,
    );
  }

  async getAccountSummary(unitId: string) {
    const unit = await this.findOne(unitId);
    const balance = await this.balanceService.getBalance(unitId);
    const [primaryResident, lastPayment, openCharges] = await Promise.all([
      this.prisma.unitResident.findFirst({
        where: { unitId, status: UnitResidentStatus.ACTIVE, isPrimary: true },
        include: { resident: true },
      }),
      this.prisma.payment.findFirst({
        where: { unitId, cancelledAt: null },
        orderBy: { paymentDate: 'desc' },
      }),
      this.prisma.unitCharge.count({
        where: { unitId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      }),
    ]);

    return {
      unit,
      primaryResident: primaryResident?.resident ?? null,
      balance,
      openChargesCount: openCharges,
      lastPayment: lastPayment
        ? { ...lastPayment, amount: moneyString(lastPayment.amount) }
        : null,
    };
  }

  async getTimeline(unitId: string, limit = 50) {
    await this.findOne(unitId);
    const [charges, payments] = await Promise.all([
      this.prisma.unitCharge.findMany({
        where: { unitId },
        include: { chargeType: true },
        orderBy: { chargeDate: 'desc' },
        take: limit,
      }),
      this.prisma.payment.findMany({
        where: { unitId },
        orderBy: { paymentDate: 'desc' },
        take: limit,
      }),
    ]);

    const events = [
      ...charges.map((c) => ({
        type: 'CHARGE' as const,
        date: c.chargeDate,
        id: c.id,
        description: c.description ?? c.chargeType?.name,
        amount: moneyString(c.amount),
        movementType: c.movementType,
        status: c.status,
      })),
      ...payments.map((p) => ({
        type: 'PAYMENT' as const,
        date: p.paymentDate,
        id: p.id,
        description: p.reference ?? 'Payment',
        amount: moneyString(p.amount),
        movementType: 'CREDIT' as const,
        status: p.status,
      })),
    ];

    events.sort((a, b) => b.date.getTime() - a.date.getTime());
    return events.slice(0, limit);
  }
}
