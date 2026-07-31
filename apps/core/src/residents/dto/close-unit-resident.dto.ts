import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class CloseUnitResidentDto {
  @ApiPropertyOptional({ description: 'Defaults to now() if omitted' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
