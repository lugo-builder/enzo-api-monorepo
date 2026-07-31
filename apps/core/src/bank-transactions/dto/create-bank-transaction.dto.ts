import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BankTransactionType, Currency } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateBankTransactionDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;

  @ApiProperty()
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  postingDate?: string;

  @ApiProperty({ description: 'Decimal string, e.g. "1500.00"' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a decimal string with up to 2 places' })
  amount: string;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ enum: BankTransactionType })
  @IsOptional()
  @IsEnum(BankTransactionType)
  transactionType?: BankTransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  concept?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderAccountMasked?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rawDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
