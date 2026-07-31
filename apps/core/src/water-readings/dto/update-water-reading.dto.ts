import { ApiPropertyOptional } from '@nestjs/swagger';
import { WaterReadingCalculationMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateWaterReadingDto {
  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'currentReading must be a decimal string' })
  currentReading?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'previousReading must be a decimal string' })
  previousReading?: string;

  @ApiPropertyOptional({ description: 'Decimal string, MXN (can be negative)' })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,2})?$/, {
    message: 'macroDifferencePrice must be a decimal string with at most 2 decimals',
  })
  macroDifferencePrice?: string;

  @ApiPropertyOptional({ description: 'Decimal string (can be negative)' })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,2})?$/, { message: 'manualAdjustment must be a decimal string' })
  manualAdjustment?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'reserveFundAmount must be a decimal string' })
  reserveFundAmount?: string;

  @ApiPropertyOptional({ enum: WaterReadingCalculationMode })
  @IsOptional()
  @IsEnum(WaterReadingCalculationMode)
  calculationMode?: WaterReadingCalculationMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
