import { ApiPropertyOptional } from '@nestjs/swagger';
import { ImportBatchStatus, ImportBatchType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class ImportFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentialComplexId?: string;

  @ApiPropertyOptional({ enum: ImportBatchType })
  @IsOptional()
  @IsEnum(ImportBatchType)
  type?: ImportBatchType;

  @ApiPropertyOptional({ enum: ImportBatchStatus })
  @IsOptional()
  @IsEnum(ImportBatchStatus)
  status?: ImportBatchStatus;
}
