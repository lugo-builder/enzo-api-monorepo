import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CancelChargeDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
