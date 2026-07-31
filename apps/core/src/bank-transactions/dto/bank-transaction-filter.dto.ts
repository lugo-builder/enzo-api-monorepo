import { ApiPropertyOptional } from '@nestjs/swagger';
import { BankTransactionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class BankTransactionFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentialComplexId?: string;

  @ApiPropertyOptional({ enum: BankTransactionStatus })
  @IsOptional()
  @IsEnum(BankTransactionStatus)
  status?: BankTransactionStatus;
}
