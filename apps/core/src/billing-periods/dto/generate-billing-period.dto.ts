import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateBillingPeriodDto {
  @ApiPropertyOptional({
    description: 'When true, persists the generated charges. Defaults to a dry-run preview.',
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;

  @ApiPropertyOptional({
    description: 'Restrict generation to these ChargeType ids (defaults to all recurring/active charge types)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chargeTypeIds?: string[];
}
