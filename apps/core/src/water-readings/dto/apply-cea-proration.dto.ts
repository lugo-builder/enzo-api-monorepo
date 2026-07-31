import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Aplica datos del recibo CEA al periodo y calcula el prorrateo:
 * (monto recibo − suma pagos individuales por m³ − costo servicio × N) / N
 */
export class ApplyCeaProrationDto {
  @ApiProperty({
    example: '45280.00',
    description: 'Monto total a pagar del recibo CEA (MXN)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'ceaBillTotalCost must be a decimal string with at most 2 decimals',
  })
  ceaBillTotalCost: string;

  @ApiPropertyOptional({
    example: '1850.00',
    description: 'Metros cúbicos del macromedidor en el recibo CEA',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message:
      'macrometerM3FromBill must be a decimal string with at most 4 decimals',
  })
  macrometerM3FromBill?: string;

  @ApiPropertyOptional({
    example: '1760.00',
    description: 'Metros cúbicos totales del macromedidor físico',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message:
      'physicalMacrometerM3 must be a decimal string with at most 4 decimals',
  })
  physicalMacrometerM3?: string;

  @ApiPropertyOptional({
    example: '40.00',
    description: 'Cargo por servicio de lectura por vivienda (MXN)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'priceService must be a decimal string with at most 2 decimals',
  })
  priceService?: string;
}
