import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaterBillingPeriodStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class WaterPeriodFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentialComplexId?: string;

  @ApiPropertyOptional({ enum: WaterBillingPeriodStatus })
  @IsOptional()
  @IsEnum(WaterBillingPeriodStatus)
  status?: WaterBillingPeriodStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  billingYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  billingMonth?: number;
}
