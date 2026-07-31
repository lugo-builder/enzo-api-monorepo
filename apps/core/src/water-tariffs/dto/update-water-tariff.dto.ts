import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { WaterTariffStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { CreateTariffTierDto } from './create-tariff-tier.dto';
import { CreateWaterTariffDto } from './create-water-tariff.dto';

export class UpdateWaterTariffDto extends PartialType(CreateWaterTariffDto) {
  @ApiPropertyOptional({
    type: [CreateTariffTierDto],
    description: 'Replaces the full tier list when provided',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTariffTierDto)
  tiers?: CreateTariffTierDto[];

  @ApiPropertyOptional({ enum: WaterTariffStatus })
  @IsOptional()
  @IsEnum(WaterTariffStatus)
  status?: WaterTariffStatus;
}
