import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class IgnoreTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
