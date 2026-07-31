import { ApiPropertyOptional } from '@nestjs/swagger';
import { UnitChargeSource, UnitChargeStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class ChargeFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingPeriodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chargeTypeId?: string;

  @ApiPropertyOptional({ enum: UnitChargeStatus })
  @IsOptional()
  @IsEnum(UnitChargeStatus)
  status?: UnitChargeStatus;

  @ApiPropertyOptional({ enum: UnitChargeSource })
  @IsOptional()
  @IsEnum(UnitChargeSource)
  source?: UnitChargeSource;
}
