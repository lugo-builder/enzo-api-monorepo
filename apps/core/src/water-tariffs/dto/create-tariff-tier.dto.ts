import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WaterTariffCalculationType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateTariffTierDto {
  @ApiProperty({
    example: '5',
    description: 'Metros cúbicos de la fila (clave de lookup, entero)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'm3 must be a decimal string' })
  m3: string;

  @ApiPropertyOptional({
    example: '157.00',
    description: 'Precio total MXN para ese m³ (tabla CEA)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'fixedAmount must be a decimal string' })
  fixedAmount?: string;

  @ApiPropertyOptional({ description: 'Decimal string (legacy / PER_M3)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'amountPerM3 must be a decimal string' })
  amountPerM3?: string;

  @ApiPropertyOptional({
    enum: WaterTariffCalculationType,
    default: WaterTariffCalculationType.LOOKUP_BY_M3,
  })
  @IsOptional()
  @IsEnum(WaterTariffCalculationType)
  calculationType?: WaterTariffCalculationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
