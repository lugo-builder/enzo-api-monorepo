import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaterReadingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class WaterReadingFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingPeriodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ enum: WaterReadingStatus })
  @IsOptional()
  @IsEnum(WaterReadingStatus)
  status?: WaterReadingStatus;
}
