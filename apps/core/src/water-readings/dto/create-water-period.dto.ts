import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateWaterPeriodDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  readingStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  readingEndDate?: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  billingYear: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tariffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: '45280.00',
    description: 'Costo total del recibo CEA (MXN)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'ceaBillTotalCost must be a decimal string with at most 2 decimals',
  })
  ceaBillTotalCost?: string;

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
}
