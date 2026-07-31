import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { paginate } from '../hydra-shared/money.util';
import { CreateResidentDto } from './dto/create-resident.dto';
import { ResidentFilterDto } from './dto/resident-filter.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';

@Injectable()
export class ResidentsService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateResidentDto, userId: string) {
    const fullName = dto.fullName ?? [dto.firstName, dto.lastName].filter(Boolean).join(' ');
    const resident = await this.prisma.resident.create({
      data: { ...dto, fullName, createdBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'Resident',
      entityId: resident.id,
      action: 'RESIDENT_CREATE',
      newData: { ...dto },
    });
    return resident;
  }

  async findAll(query: ResidentFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.ResidentWhereInput = {};
    if (query.fullName) where.fullName = { contains: query.fullName };
    if (query.status) where.status = query.status;
    if (query.unitId) {
      where.unitResidents = { some: { unitId: query.unitId } };
    }
    if (query.globalFilter) {
      where.OR = [
        { fullName: { contains: query.globalFilter } },
        { email: { contains: query.globalFilter } },
        { phone: { contains: query.globalFilter } },
      ];
    }

    const [totalRecords, data] = await Promise.all([
      this.prisma.resident.count({ where }),
      this.prisma.resident.findMany({
        where,
        skip,
        take,
        orderBy: { fullName: 'asc' },
      }),
    ]);
    return { totalRecords, data };
  }

  async findOne(id: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id, deletedAt: null },
      include: {
        unitResidents: { include: { unit: true } },
      },
    });
    if (!resident) throw new NotFoundException('Resident not found');
    return resident;
  }

  async update(id: string, dto: UpdateResidentDto, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.resident.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'Resident',
      entityId: id,
      action: 'RESIDENT_UPDATE',
      newData: { ...dto },
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.resident.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'Resident',
      entityId: id,
      action: 'RESIDENT_DELETE',
    });
    return { success: true };
  }
}
