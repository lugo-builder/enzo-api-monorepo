import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaterMeterStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class WaterMeterFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ enum: WaterMeterStatus })
  @IsOptional()
  @IsEnum(WaterMeterStatus)
  status?: WaterMeterStatus;
}
