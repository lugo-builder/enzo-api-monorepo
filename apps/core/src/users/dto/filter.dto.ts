import { IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class FilterDto extends BaseQueryDTO {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  createdAt?: string; // Se podría agregar una lógica para manejar fechas como rangos
}
