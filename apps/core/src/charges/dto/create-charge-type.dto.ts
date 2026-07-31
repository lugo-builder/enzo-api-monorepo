import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChargeCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateChargeTypeDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ChargeCategory })
  @IsEnum(ChargeCategory)
  category: ChargeCategory;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'defaultAmount must be a decimal string' })
  defaultAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  affectsBalance?: boolean;
}
