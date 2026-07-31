import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingPeriodStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class BillingPeriodFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentialComplexId?: string;

  @ApiPropertyOptional({ enum: BillingPeriodStatus })
  @IsOptional()
  @IsEnum(BillingPeriodStatus)
  status?: BillingPeriodStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  month?: number;
}
