import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaterTariffStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class WaterTariffFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentialComplexId?: string;

  @ApiPropertyOptional({ enum: WaterTariffStatus })
  @IsOptional()
  @IsEnum(WaterTariffStatus)
  status?: WaterTariffStatus;
}
