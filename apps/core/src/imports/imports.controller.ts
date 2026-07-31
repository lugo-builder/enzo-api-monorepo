import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { Can, CurrentUser, Roles, RolesEnum } from '@app/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsEnum } from '../role/types/permissions.enums';
import { ImportFilterDto } from './dto/import-filter.dto';
import { JsonImportDto } from './dto/json-import.dto';
import { UploadImportDto } from './dto/upload-import.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
@ApiTags('imports')
@ApiBearerAuth()
@Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('upload')
  @Can(PermissionsEnum.RESIDENT_IMPORTS)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Body() dto: UploadImportDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user,
  ) {
    return this.importsService.upload(
      dto.residentialComplexId,
      dto.type,
      file,
      user.userId,
    );
  }

  @Post('json')
  @Can(PermissionsEnum.RESIDENT_IMPORTS)
  @ApiBody({ type: JsonImportDto })
  uploadJson(@Body() dto: JsonImportDto, @CurrentUser() user) {
    return this.importsService.uploadFromJson(
      dto.residentialComplexId,
      dto.type,
      dto.rows,
      user.userId,
      dto.filename,
    );
  }

  @Get()
  @Can(PermissionsEnum.RESIDENT_IMPORTS)
  findAll(@Query() query: ImportFilterDto) {
    return this.importsService.findAll(query);
  }

  @Get(':id')
  @Can(PermissionsEnum.RESIDENT_IMPORTS)
  findOne(@Param('id') id: string) {
    return this.importsService.findOne(id);
  }

  @Post(':id/validate')
  @Can(PermissionsEnum.RESIDENT_IMPORTS)
  validate(@Param('id') id: string, @CurrentUser() user) {
    return this.importsService.validate(id, user.userId);
  }

  @Get(':id/preview')
  @Can(PermissionsEnum.RESIDENT_IMPORTS)
  preview(@Param('id') id: string) {
    return this.importsService.preview(id);
  }

  @Post(':id/confirm')
  @Can(PermissionsEnum.RESIDENT_IMPORTS)
  confirm(@Param('id') id: string, @CurrentUser() user) {
    return this.importsService.confirm(id, user.userId);
  }
}
