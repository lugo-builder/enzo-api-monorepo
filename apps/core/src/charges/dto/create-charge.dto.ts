import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChargeMovementType, Currency } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateChargeDto {
  @ApiProperty()
  @IsString()
  unitId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingPeriodId?: string;

  @ApiProperty()
  @IsString()
  chargeTypeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Decimal string, e.g. "250.00"' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a decimal string with up to 2 places' })
  amount: string;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ enum: ChargeMovementType })
  @IsOptional()
  @IsEnum(ChargeMovementType)
  movementType?: ChargeMovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  chargeDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
