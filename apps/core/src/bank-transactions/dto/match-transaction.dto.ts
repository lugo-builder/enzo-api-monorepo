import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MatchTransactionDto {
  @ApiProperty()
  @IsString()
  unitId: string;
}
