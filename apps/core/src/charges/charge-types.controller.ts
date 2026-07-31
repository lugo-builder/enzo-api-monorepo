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
import { ChargeTypesService } from './charge-types.service';
import { ChargeTypeFilterDto } from './dto/charge-type-filter.dto';
import { CreateChargeTypeDto } from './dto/create-charge-type.dto';
import { UpdateChargeTypeDto } from './dto/update-charge-type.dto';

@Controller('charge-types')
@ApiTags('charges')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class ChargeTypesController {
  constructor(private readonly chargeTypesService: ChargeTypesService) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  create(@Body() dto: CreateChargeTypeDto, @CurrentUser() user) {
    return this.chargeTypesService.create(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  findAll(@Query() query: ChargeTypeFilterDto) {
    return this.chargeTypesService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  findOne(@Param('id') id: string) {
    return this.chargeTypesService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_CHARGES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChargeTypeDto,
    @CurrentUser() user,
  ) {
    return this.chargeTypesService.update(id, dto, user.userId);
  }
}
