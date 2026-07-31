import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { ChargesService } from './charges.service';
import { BulkCreateChargesDto } from './dto/bulk-create-charges.dto';
import { CancelChargeDto } from './dto/cancel-charge.dto';
import { ChargeFilterDto } from './dto/charge-filter.dto';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';

@Controller('charges')
@ApiTags('charges')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class ChargesController {
  constructor(private readonly chargesService: ChargesService) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  create(@Body() dto: CreateChargeDto, @CurrentUser() user) {
    return this.chargesService.create(dto, user.userId);
  }

  @Post('bulk')
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  bulkCreate(@Body() dto: BulkCreateChargesDto, @CurrentUser() user) {
    return this.chargesService.bulkCreate(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  findAll(@Query() query: ChargeFilterDto) {
    return this.chargesService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  findOne(@Param('id') id: string) {
    return this.chargesService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChargeDto,
    @CurrentUser() user,
  ) {
    return this.chargesService.update(id, dto, user.userId);
  }

  @Post(':id/cancel')
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelChargeDto,
    @CurrentUser() user,
  ) {
    return this.chargesService.cancel(id, dto.reason, user.userId);
  }
}
