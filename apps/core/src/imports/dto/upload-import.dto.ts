import { ApiProperty } from '@nestjs/swagger';
import { ImportBatchType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class UploadImportDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;

  @ApiProperty({ enum: ImportBatchType })
  @IsEnum(ImportBatchType)
  type: ImportBatchType;
}
