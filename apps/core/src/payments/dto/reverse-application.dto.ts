import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReverseApplicationDto {
  @ApiProperty()
  @IsString()
  unitChargeId: string;

  @ApiProperty()
  @IsString()
  reason: string;
}
