import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class SimulateWaterTariffDto {
  @ApiProperty({ description: 'Decimal string, raw consumption in m3' })
  @IsString()
  @Matches(/^-?\d+(\.\d{1,4})?$/, { message: 'consumptionM3 must be a decimal string' })
  consumptionM3: string;

  @ApiPropertyOptional({ description: 'Decimal string, macro-meter difference in MXN' })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,2})?$/, {
    message: 'macroDifferencePrice must be a decimal string with at most 2 decimals',
  })
  macroDifferencePrice?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,2})?$/, { message: 'manualAdjustment must be a decimal string' })
  manualAdjustment?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,2})?$/, { message: 'reserveFund must be a decimal string' })
  reserveFund?: string;
}
