import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, ListResponseDto, Roles, RolesEnum } from '@app/common';
import { DatabaseService } from '@app/database';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { paginate } from '../hydra-shared/money.util';
import { AuditFilterDto } from './dto/audit-filter.dto';

@Controller('audit')
@ApiTags('audit')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly prisma: DatabaseService) {}

  @Get()
  @Can(PermissionsEnum.RESIDENT_AUDIT)
  async findAll(@Query() query: AuditFilterDto) {
    const { skip, take } = paginate(query.page, query.pageSize);
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;

    const [totalRecords, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { totalRecords, data } as ListResponseDto<any>;
  }
}
