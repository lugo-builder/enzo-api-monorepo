import { Injectable, NotFoundException } from '@nestjs/common';
import { UnitResidentStatus } from '@prisma/client';

import { DatabaseService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { CloseUnitResidentDto } from './dto/close-unit-resident.dto';
import { CreateUnitResidentDto } from './dto/create-unit-resident.dto';
import { UpdateUnitResidentDto } from './dto/update-unit-resident.dto';

@Injectable()
export class UnitResidentsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  private async assertUnit(unitId: string) {
    const unit = await this.prisma.residentialUnit.findFirst({
      where: { id: unitId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async create(unitId: string, dto: CreateUnitResidentDto, userId: string) {
    await this.assertUnit(unitId);

    let residentId = dto.residentId;
    if (!residentId) {
      if (!dto.resident) {
        throw new NotFoundException('residentId or resident payload is required');
      }
      const fullName =
        dto.resident.fullName ??
        [dto.resident.firstName, dto.resident.lastName].filter(Boolean).join(' ');
      const resident = await this.prisma.resident.create({
        data: { ...dto.resident, fullName, createdBy: userId },
      });
      residentId = resident.id;
    } else {
      const resident = await this.prisma.resident.findFirst({
        where: { id: residentId, deletedAt: null },
      });
      if (!resident) throw new NotFoundException('Resident not found');
    }

    if (dto.isPrimary) {
      await this.prisma.unitResident.updateMany({
        where: { unitId, status: UnitResidentStatus.ACTIVE, isPrimary: true },
        data: { isPrimary: false, updatedBy: userId },
      });
    }

    const unitResident = await this.prisma.unitResident.create({
      data: {
        unitId,
        residentId,
        relationshipType: dto.relationshipType,
        isPrimary: dto.isPrimary,
        isPaymentResponsible: dto.isPaymentResponsible,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        createdBy: userId,
      },
      include: { resident: true },
    });

    await this.auditService.log({
      userId,
      entityType: 'UnitResident',
      entityId: unitResident.id,
      action: 'UNIT_RESIDENT_CREATE',
      newData: { unitId, residentId },
    });

    return unitResident;
  }

  async findOneOrThrow(unitId: string, unitResidentId: string) {
    const unitResident = await this.prisma.unitResident.findFirst({
      where: { id: unitResidentId, unitId },
      include: { resident: true },
    });
    if (!unitResident) throw new NotFoundException('Unit-resident relation not found');
    return unitResident;
  }

  async update(
    unitId: string,
    unitResidentId: string,
    dto: UpdateUnitResidentDto,
    userId: string,
  ) {
    await this.findOneOrThrow(unitId, unitResidentId);

    if (dto.isPrimary) {
      await this.prisma.unitResident.updateMany({
        where: {
          unitId,
          status: UnitResidentStatus.ACTIVE,
          isPrimary: true,
          id: { not: unitResidentId },
        },
        data: { isPrimary: false, updatedBy: userId },
      });
    }

    const updated = await this.prisma.unitResident.update({
      where: { id: unitResidentId },
      data: { ...dto, updatedBy: userId },
      include: { resident: true },
    });

    await this.auditService.log({
      userId,
      entityType: 'UnitResident',
      entityId: unitResidentId,
      action: 'UNIT_RESIDENT_UPDATE',
      newData: { ...dto },
    });

    return updated;
  }

  /** DELETE closes the relation (endDate + status ENDED) instead of a hard delete. */
  async close(
    unitId: string,
    unitResidentId: string,
    dto: CloseUnitResidentDto,
    userId: string,
  ) {
    await this.findOneOrThrow(unitId, unitResidentId);

    const closed = await this.prisma.unitResident.update({
      where: { id: unitResidentId },
      data: {
        status: UnitResidentStatus.ENDED,
        endDate: dto.endDate ? new Date(dto.endDate) : new Date(),
        updatedBy: userId,
      },
      include: { resident: true },
    });

    await this.auditService.log({
      userId,
      entityType: 'UnitResident',
      entityId: unitResidentId,
      action: 'UNIT_RESIDENT_CLOSE',
      newData: { endDate: closed.endDate },
    });

    return closed;
  }
}
