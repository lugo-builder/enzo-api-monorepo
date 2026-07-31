import {
  Body,
  Controller,
  Delete,
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
import { CreateResidentDto } from './dto/create-resident.dto';
import { ResidentFilterDto } from './dto/resident-filter.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { ResidentsService } from './residents.service';

@Controller('residents')
@ApiTags('residents')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_RESIDENTS)
  create(@Body() dto: CreateResidentDto, @CurrentUser() user) {
    return this.residentsService.create(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_RESIDENTS)
  findAll(@Query() query: ResidentFilterDto) {
    return this.residentsService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_RESIDENTS)
  findOne(@Param('id') id: string) {
    return this.residentsService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_RESIDENTS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateResidentDto,
    @CurrentUser() user,
  ) {
    return this.residentsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Can(PermissionsEnum.RESIDENT_RESIDENTS)
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.residentsService.remove(id, user.userId);
  }
}
