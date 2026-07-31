import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AccountStatementQueryDto {
  @ApiPropertyOptional({ description: 'Scope the statement to a specific billing period' })
  @IsOptional()
  @IsString()
  billingPeriodId?: string;
}
