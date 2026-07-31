import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WaterMeterStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateWaterMeterDto {
  @ApiProperty()
  @IsString()
  unitId: string;

  @ApiProperty()
  @IsString()
  serialNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @ApiPropertyOptional({ description: 'Decimal string, e.g. "0.0000"' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'initialReading must be a decimal string' })
  initialReading?: string;

  @ApiPropertyOptional({ enum: WaterMeterStatus })
  @IsOptional()
  @IsEnum(WaterMeterStatus)
  status?: WaterMeterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
