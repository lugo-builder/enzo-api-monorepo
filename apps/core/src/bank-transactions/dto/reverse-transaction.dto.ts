import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReverseTransactionDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
