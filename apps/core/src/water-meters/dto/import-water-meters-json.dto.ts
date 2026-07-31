import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class WaterMeterJsonRowDto {
  @ApiProperty({ example: '1', description: 'Número de casa en el complejo' })
  @IsString()
  unitNumber: string;

  @ApiPropertyOptional({
    example: '19000193',
    description: 'Folio / serial del micromedidor',
  })
  @ValidateIf((o) => !o.meterSerial)
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    example: '19000193',
    description: 'Alias de serialNumber (compatible con JSON de lecturas)',
  })
  @ValidateIf((o) => !o.serialNumber)
  @IsString()
  meterSerial?: string;

  @ApiPropertyOptional({
    example: '49.00',
    description: 'Lectura inicial del medidor (decimal string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'initialReading must be a decimal string',
  })
  initialReading?: string;

  @ApiPropertyOptional({
    description: 'Alias de initialReading al reutilizar JSON de lecturas',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'previousReading must be a decimal string',
  })
  previousReading?: string;

  @ApiPropertyOptional({ description: 'Ignorado en import de medidores' })
  @IsOptional()
  @IsString()
  currentReading?: string;

  @ApiPropertyOptional({ description: 'Ignorado en import de medidores' })
  @IsOptional()
  @IsString()
  calculationMode?: string;
}

/**
 * Alta masiva de micromedidores.
 * También acepta el arreglo `readings` del JSON de lecturas (usa meterSerial + previousReading).
 */
export class ImportWaterMetersJsonDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;

  @ApiPropertyOptional({ type: [WaterMeterJsonRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaterMeterJsonRowDto)
  meters?: WaterMeterJsonRowDto[];

  @ApiPropertyOptional({
    type: [WaterMeterJsonRowDto],
    description:
      'Compatible con docs/lecturas/*.json: unitNumber + meterSerial + previousReading → initialReading',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WaterMeterJsonRowDto)
  readings?: WaterMeterJsonRowDto[];
}
