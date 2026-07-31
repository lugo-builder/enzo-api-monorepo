import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ReplaceWaterMeterDto {
  @ApiProperty()
  @IsString()
  newSerialNumber: string;

  @ApiPropertyOptional({ description: 'Reading on the old meter at removal time' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'finalReading must be a decimal string' })
  finalReading?: string;

  @ApiPropertyOptional({ description: 'Initial reading of the new meter. Defaults to "0"' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, { message: 'initialReading must be a decimal string' })
  initialReading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  replacementDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
