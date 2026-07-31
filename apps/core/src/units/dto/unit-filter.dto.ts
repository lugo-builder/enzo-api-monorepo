import { ApiPropertyOptional } from '@nestjs/swagger';
import { ResidentialUnitStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryDTO } from '@app/common';

export class UnitFilterDto extends BaseQueryDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residentialComplexId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @ApiPropertyOptional({ enum: ResidentialUnitStatus })
  @IsOptional()
  @IsEnum(ResidentialUnitStatus)
  status?: ResidentialUnitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceStatus?: string;

  @ApiPropertyOptional({ description: 'Filter units by a resident name (partial match)' })
  @IsOptional()
  @IsString()
  residentName?: string;

  @ApiPropertyOptional({
    description: 'When true, only return units with an outstanding balance > 0',
  })
  @IsOptional()
  @IsBoolean()
  hasDebt?: boolean;
}
