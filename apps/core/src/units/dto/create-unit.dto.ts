import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResidentialUnitStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;

  @ApiProperty()
  @IsString()
  unitNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ enum: ResidentialUnitStatus })
  @IsOptional()
  @IsEnum(ResidentialUnitStatus)
  status?: ResidentialUnitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
