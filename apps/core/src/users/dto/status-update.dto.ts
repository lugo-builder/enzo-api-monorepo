import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StatusUpdateDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  status: string;
}
