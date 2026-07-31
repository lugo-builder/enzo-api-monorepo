import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { paginate } from '../hydra-shared/money.util';
import { ResidentialComplexFilterDto } from './dto/residential-complex-filter.dto';
import { CreateResidentialComplexDto } from './dto/create-residential-complex.dto';
import { UpdateResidentialComplexDto } from './dto/update-residential-complex.dto';

@Injectable()
export class ResidentialComplexesService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateResidentialComplexDto, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.create({
      data: { ...dto, createdBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'ResidentialComplex',
      entityId: residentialComplex.id,
      action: 'RESIDENTIAL_COMPLEX_CREATE',
      newData: { ...dto },
    });
    return residentialComplex;
  }

  async findAll(query: ResidentialComplexFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.ResidentialComplexWhereInput = {};
    if (query.name) where.name = { contains: query.name };
    if (query.status) where.status = query.status;
    if (query.globalFilter) {
      where.OR = [
        { name: { contains: query.globalFilter } },
        { legalName: { contains: query.globalFilter } },
        { taxId: { contains: query.globalFilter } },
      ];
    }

    const [totalRecords, data] = await Promise.all([
      this.prisma.residentialComplex.count({ where }),
      this.prisma.residentialComplex.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
    ]);
    return { totalRecords, data };
  }

  async findOne(id: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id, deletedAt: null },
    });
    if (!residentialComplex) {
      throw new NotFoundException('ResidentialComplex not found');
    }
    return residentialComplex;
  }

  async update(id: string, dto: UpdateResidentialComplexDto, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.residentialComplex.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'ResidentialComplex',
      entityId: id,
      action: 'RESIDENTIAL_COMPLEX_UPDATE',
      newData: { ...dto },
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.residentialComplex.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
    await this.auditService.log({
      userId,
      entityType: 'ResidentialComplex',
      entityId: id,
      action: 'RESIDENTIAL_COMPLEX_DELETE',
    });
    return { success: true };
  }
}
