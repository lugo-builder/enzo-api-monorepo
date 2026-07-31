import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WaterTariffRoundingMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CreateTariffTierDto } from './create-tariff-tier.dto';

export class CreateWaterTariffDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: '05-2026',
    description: 'Vigencia CEA MM-YYYY (clave de upsert para from-lookup-json)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])-\d{4}$/, {
    message: 'rateTariffDate must be MM-YYYY (e.g. "05-2026")',
  })
  rateTariffDate?: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'baseCharge must be a decimal string' })
  baseCharge?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'minimumConsumptionM3 must be a decimal string' })
  minimumConsumptionM3?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'discountAmount must be a decimal string' })
  discountAmount?: string;

  @ApiPropertyOptional({ description: 'Decimal string (percentage 0-100)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'discountPercentage must be a decimal string' })
  discountPercentage?: string;

  @ApiPropertyOptional({ enum: WaterTariffRoundingMode })
  @IsOptional()
  @IsEnum(WaterTariffRoundingMode)
  roundingMode?: WaterTariffRoundingMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateTariffTierDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTariffTierDto)
  tiers: CreateTariffTierDto[];
}
