import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DatabaseService } from '@app/database';
import { ListResponseDto } from '@app/common';

import { AuditService } from '../audit/audit.service';
import { paginate, toDecimal } from '../hydra-shared/money.util';
import { ChargeTypeFilterDto } from './dto/charge-type-filter.dto';
import { CreateChargeTypeDto } from './dto/create-charge-type.dto';
import { UpdateChargeTypeDto } from './dto/update-charge-type.dto';

@Injectable()
export class ChargeTypesService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateChargeTypeDto, userId: string) {
    const residentialComplex = await this.prisma.residentialComplex.findFirst({
      where: { id: dto.residentialComplexId, deletedAt: null },
    });
    if (!residentialComplex) throw new NotFoundException('ResidentialComplex not found');

    const duplicate = await this.prisma.chargeType.findUnique({
      where: {
        residentialComplexId_code: { residentialComplexId: dto.residentialComplexId, code: dto.code },
      },
    });
    if (duplicate) throw new BadRequestException('Charge type code already exists');

    const chargeType = await this.prisma.chargeType.create({
      data: {
        ...dto,
        defaultAmount: dto.defaultAmount ? toDecimal(dto.defaultAmount) : undefined,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      userId,
      entityType: 'ChargeType',
      entityId: chargeType.id,
      action: 'CHARGE_TYPE_CREATE',
      newData: { ...dto },
    });

    return chargeType;
  }

  async findAll(query: ChargeTypeFilterDto): Promise<ListResponseDto<any>> {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: Prisma.ChargeTypeWhereInput = {};
    if (query.residentialComplexId) where.residentialComplexId = query.residentialComplexId;
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;

    const [totalRecords, data] = await Promise.all([
      this.prisma.chargeType.count({ where }),
      this.prisma.chargeType.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    ]);
    return { totalRecords, data };
  }

  async findOne(id: string) {
    const chargeType = await this.prisma.chargeType.findUnique({ where: { id } });
    if (!chargeType) throw new NotFoundException('Charge type not found');
    return chargeType;
  }

  async update(id: string, dto: UpdateChargeTypeDto, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.chargeType.update({
      where: { id },
      data: {
        ...dto,
        defaultAmount: dto.defaultAmount ? toDecimal(dto.defaultAmount) : undefined,
        updatedBy: userId,
      },
    });
    await this.auditService.log({
      userId,
      entityType: 'ChargeType',
      entityId: id,
      action: 'CHARGE_TYPE_UPDATE',
      newData: { ...dto },
    });
    return updated;
  }
}
