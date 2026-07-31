import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WaterReadingCalculationMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class WaterReadingJsonRowDto {
  @ApiPropertyOptional({
    example: '19000193',
    description: 'Folio / número de serie del micromedidor (preferido)',
  })
  @IsOptional()
  @IsString()
  meterSerial?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Número de casa; alternativa si no se envía meterSerial',
  })
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @ApiProperty({
    example: '49.00',
    description: 'Lectura inicial (cierre anterior)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'previousReading must be a decimal string with at most 2 decimals',
  })
  previousReading: string;

  @ApiProperty({
    example: '50.00',
    description: 'Lectura final del periodo',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'currentReading must be a decimal string with at most 2 decimals',
  })
  currentReading: string;

  @ApiPropertyOptional({
    example: '10.00',
    description:
      'Diferencia del macromedidor en pesos (MXN); se suma al total de la vivienda. ' +
      'Si se omite y hay macroDifferencePrice global, se usa ese valor.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,2})?$/, {
    message: 'macroDifferencePrice must be a decimal string with at most 2 decimals',
  })
  macroDifferencePrice?: string;

  @ApiPropertyOptional({ enum: WaterReadingCalculationMode })
  @IsOptional()
  @IsEnum(WaterReadingCalculationMode)
  calculationMode?: WaterReadingCalculationMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Cabecera del recibo CEA / macromedidor para el periodo.
 * Se persiste en WaterBillingPeriod (auditoría y conciliación).
 */
export class CeaBillJsonDto {
  @ApiPropertyOptional({
    example: '45280.00',
    description: 'Costo total del recibo CEA (MXN)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'ceaBill.totalCost must be a decimal string with at most 2 decimals',
  })
  totalCost?: string;

  @ApiPropertyOptional({
    example: '1850.00',
    description: 'Metros cúbicos del macromedidor en el recibo CEA',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message:
      'ceaBill.macrometerM3FromBill must be a decimal string with at most 4 decimals',
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
      'ceaBill.physicalMacrometerM3 must be a decimal string with at most 4 decimals',
  })
  physicalMacrometerM3?: string;
}

/**
 * Carga masiva de lecturas para un periodo (sin evidencia fotográfica).
 *
 * Ejemplo:
 * {
 *   "ceaBill": {
 *     "totalCost": "45280.00",
 *     "macrometerM3FromBill": "1850.00",
 *     "physicalMacrometerM3": "1760.00"
 *   },
 *   "priceService": "40.00",
 *   "macroDifferencePrice": "10.00",
 *   "calculate": true,
 *   "readings": [
 *     {
 *       "unitNumber": "1",
 *       "meterSerial": "19000193",
 *       "previousReading": "49.00",
 *       "currentReading": "50.00"
 *     }
 *   ]
 * }
 */
export class ImportWaterReadingsJsonDto {
  @ApiPropertyOptional({ type: CeaBillJsonDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CeaBillJsonDto)
  ceaBill?: CeaBillJsonDto;

  @ApiPropertyOptional({
    example: '40.00',
    description:
      'Cargo fijo por servicio de lectura aplicado a cada vivienda (se suma al total)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'priceService must be a decimal string with at most 2 decimals',
  })
  priceService?: string;

  @ApiPropertyOptional({
    example: '10.00',
    description:
      'Diferencia del macromedidor (MXN) aplicada a cada vivienda que no traiga ' +
      'macroDifferencePrice en su fila',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+(\.\d{1,2})?$/, {
    message: 'macroDifferencePrice must be a decimal string with at most 2 decimals',
  })
  macroDifferencePrice?: string;

  @ApiProperty({ type: [WaterReadingJsonRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WaterReadingJsonRowDto)
  readings: WaterReadingJsonRowDto[];

  @ApiPropertyOptional({
    default: true,
    description: 'Si true, ejecuta calculate() al terminar el import',
  })
  @IsOptional()
  @IsBoolean()
  calculate?: boolean;
}
