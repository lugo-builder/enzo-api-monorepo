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
import { ResidentialComplexesService } from './residential-complexes.service';
import { ResidentialComplexFilterDto } from './dto/residential-complex-filter.dto';
import { CreateResidentialComplexDto } from './dto/create-residential-complex.dto';
import { UpdateResidentialComplexDto } from './dto/update-residential-complex.dto';

@Controller('residential-complexes')
@ApiTags('residential-complexes')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class ResidentialComplexesController {
  constructor(
    private readonly residentialComplexesService: ResidentialComplexesService,
  ) {}

  @Post()
  @Can(PermissionsEnum.RESIDENT_RESIDENTIAL_COMPLEXES)
  create(@Body() dto: CreateResidentialComplexDto, @CurrentUser() user) {
    return this.residentialComplexesService.create(dto, user.userId);
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_RESIDENTIAL_COMPLEXES)
  findAll(@Query() query: ResidentialComplexFilterDto) {
    return this.residentialComplexesService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_RESIDENTIAL_COMPLEXES)
  findOne(@Param('id') id: string) {
    return this.residentialComplexesService.findOne(id);
  }

  @Patch(':id')
  @Can(PermissionsEnum.RESIDENT_RESIDENTIAL_COMPLEXES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateResidentialComplexDto,
    @CurrentUser() user,
  ) {
    return this.residentialComplexesService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Can(PermissionsEnum.RESIDENT_RESIDENTIAL_COMPLEXES)
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.residentialComplexesService.remove(id, user.userId);
  }
}
