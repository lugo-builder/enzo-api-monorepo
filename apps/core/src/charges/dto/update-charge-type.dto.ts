import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ChargeTypeStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateChargeTypeDto } from './create-charge-type.dto';

export class UpdateChargeTypeDto extends PartialType(CreateChargeTypeDto) {
  @ApiPropertyOptional({ enum: ChargeTypeStatus })
  @IsOptional()
  @IsEnum(ChargeTypeStatus)
  status?: ChargeTypeStatus;
}
