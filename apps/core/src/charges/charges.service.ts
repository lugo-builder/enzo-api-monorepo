import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UnitChargeStatus } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { assertBillingPeriodMutable } from '../hydra-shared/assert-billing-period-mutable';
import {
  BulkProcessErrorDto,
  bulkResponse,
} from '../hydra-shared/bulk-process-response.dto';
import { moneyString, paginate, toDecimal } from '../hydra-shared/money.util';
import { BulkCreateChargesDto } from './dto/bulk-create-charges.dto';
import { ChargeFilterDto } from './dto/charge-filter.dto';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';

@Injectable()
export class ChargesService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  private serialize(charge: any) {
    return { ...charge, amount: moneyString(charge.amount) };
  }

  async create(dto: CreateChargeDto, userId: string) {
    const [unit, chargeType] = await Promise.all([
      this.prisma.residentialUnit.findFirst({ where: { id: dto.unitId, deletedAt: null } }),
      this.prisma.chargeType.findUnique({ where: { id: dto.chargeTypeId } }),
    ]);
    if (!unit) throw new NotFoundException('Unit not found');
    if (!chargeType) throw new NotFoundException('Charge type not found');

    if (dto.billingPeriodId) {
      const period = await this.prisma.billingPeriod.findUnique({
        where: { id: dto.billingPeriodId },
      });
      if (!period) throw new NotFoundException('Billing period not found');
      if (period.status === 'CLOSED') {
        throw new ConflictException(
          'Cannot create charges on a CLOSED billing period; reopen first',
        );
      }
    }

    const charge = await this.prisma.unitCharge.create({
      data: {
        unitId: dto.unitId,
        billingPeriodId: dto.billingPeriodId,
        chargeTypeId: dto.chargeTypeId,
        description: dto.description,
        amount: toDecimal(dto.amount),
        currency: dto.currency,
        movementType: dto.movementType,
        chargeDate: dto.chargeDate ? new Date(dto.chargeDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        externalReference: dto.externalReference,
        notes: dto.notes,
        status: UnitChargeStatus.PENDING,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'UnitCharge',
      entityId: charge.id,
      action: 'CHARGE_CREATE',
      newData: { ...dto },
    });

    return this.serialize(charge);
  }

  async bulkCreate(dto: BulkCreateChargesDto, userId: string) {
    const errors: BulkProcessErrorDto[] = [];
    let processed = 0;

    for (let i = 0; i < dto.charges.length; i++) {
      try {
        await this.create(dto.charges[i], userId);
        processed += 1;
      } catch (error: any) {
        errors.push({
          row: i + 1,
          code: 'CHARGE_CREATE_ERROR',
          message: error?.message ?? 'Unknown error creating charge',
        });
      }
    }

    return bulkResponse(dto.charges.length, processed, errors);
  }

  async findAll(query: ChargeFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.UnitChargeWhereInput = {};
    if (query.unitId) where.unitId = query.unitId;
    if (query.billingPeriodId) where.billingPeriodId = query.billingPeriodId;
    if (query.chargeTypeId) where.chargeTypeId = query.chargeTypeId;
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;

    const [totalRecords, data] = await Promise.all([
      this.prisma.unitCharge.count({ where }),
      this.prisma.unitCharge.findMany({
        where,
        skip,
        take,
        include: { chargeType: true },
        orderBy: { chargeDate: 'desc' },
      }),
    ]);
    return { totalRecords, data: data.map((c) => this.serialize(c)) };
  }

  async findOne(id: string) {
    const charge = await this.prisma.unitCharge.findUnique({
      where: { id },
      include: { chargeType: true, paymentApplications: true },
    });
    if (!charge) throw new NotFoundException('Charge not found');
    return this.serialize(charge);
  }

  async update(id: string, dto: UpdateChargeDto, userId: string) {
    const existing = await this.prisma.unitCharge.findUnique({
      where: { id },
      include: { paymentApplications: { where: { reversedAt: null } } },
    });
    if (!existing) throw new NotFoundException('Charge not found');
    if (existing.status === UnitChargeStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a cancelled charge');
    }
    await assertBillingPeriodMutable(
      this.prisma,
      existing.billingPeriodId,
      'update charge',
    );
    if (
      existing.paymentApplications.length > 0 &&
      (dto.amount !== undefined || (dto as any).unitId !== undefined)
    ) {
      throw new ConflictException(
        'Cannot change amount or unit of a charge with active payment applications; reverse/cancel and create an adjustment',
      );
    }

    const updated = await this.prisma.unitCharge.update({
      where: { id },
      data: {
        description: dto.description,
        amount: dto.amount ? toDecimal(dto.amount) : undefined,
        currency: dto.currency,
        movementType: dto.movementType,
        chargeDate: dto.chargeDate ? new Date(dto.chargeDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        externalReference: dto.externalReference,
        notes: dto.notes,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'UnitCharge',
      entityId: id,
      action: 'CHARGE_UPDATE',
      newData: { ...dto },
    });

    return this.serialize(updated);
  }

  async cancel(id: string, reason: string, userId: string) {
    const charge = await this.prisma.unitCharge.findUnique({
      where: { id },
      include: { paymentApplications: { where: { reversedAt: null } } },
    });
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.status === UnitChargeStatus.CANCELLED) {
      throw new BadRequestException('Charge already cancelled');
    }
    await assertBillingPeriodMutable(
      this.prisma,
      charge.billingPeriodId,
      'cancel charge',
    );
    if (charge.paymentApplications.length > 0) {
      throw new BadRequestException(
        'Charge has active payment applications; reverse them before cancelling',
      );
    }

    const updated = await this.prisma.unitCharge.update({
      where: { id },
      data: {
        status: UnitChargeStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'UnitCharge',
      entityId: id,
      action: 'CHARGE_CANCEL',
      metadata: { reason },
    });

    return this.serialize(updated);
  }
}
