import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WaterTariffLookupMeasureDto {
  @ApiProperty({ example: 5, description: 'Consumo entero en m³ (fila de la tabla PDF)' })
  @IsInt()
  @Min(0)
  @Max(200)
  m3: number;

  @ApiProperty({
    example: '157.00',
    description: 'Costo total MXN para ese m³ (string decimal, sin separador de miles)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'price must be a decimal string without thousand separators (e.g. "1024.00")',
  })
  price: string;
}

/**
 * JSON del tarifario completo (PDF CEA): vigencia + tabla m3 → costo total.
 *
 * Ejemplo:
 * {
 *   "rateTariffDate": "05-2026",
 *   "measures": [{ "m3": 0, "price": "68.00" }, { "m3": 5, "price": "157.00" }, ...]
 * }
 */
export class CreateLookupWaterTariffDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;

  @ApiProperty({
    example: '05-2026',
    description: 'Mes-año de vigencia del PDF (MM-YYYY)',
  })
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])-\d{4}$/, {
    message: 'rateTariffDate must be MM-YYYY (e.g. "05-2026")',
  })
  rateTariffDate: string;

  @ApiProperty({ type: [WaterTariffLookupMeasureDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WaterTariffLookupMeasureDto)
  measures: WaterTariffLookupMeasureDto[];

  @ApiPropertyOptional({ description: 'Override del nombre; default "Tarifa MM-YYYY"' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
