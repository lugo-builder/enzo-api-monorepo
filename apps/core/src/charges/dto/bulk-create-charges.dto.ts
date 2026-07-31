import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateChargeDto } from './create-charge.dto';

export class BulkCreateChargesDto {
  @ApiProperty({ type: [CreateChargeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateChargeDto)
  charges: CreateChargeDto[];
}
