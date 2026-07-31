import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChargeCategory, ChargeTypeStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class ChargeTypeFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentialComplexId?: string;

  @ApiPropertyOptional({ enum: ChargeCategory })
  @IsOptional()
  @IsEnum(ChargeCategory)
  category?: ChargeCategory;

  @ApiPropertyOptional({ enum: ChargeTypeStatus })
  @IsOptional()
  @IsEnum(ChargeTypeStatus)
  status?: ChargeTypeStatus;
}
