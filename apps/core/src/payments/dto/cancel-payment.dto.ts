import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
