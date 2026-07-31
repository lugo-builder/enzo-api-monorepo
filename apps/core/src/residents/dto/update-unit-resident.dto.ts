import { ApiPropertyOptional } from '@nestjs/swagger';
import { UnitResidentRelationshipType, UnitResidentStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateUnitResidentDto {
  @ApiPropertyOptional({ enum: UnitResidentRelationshipType })
  @IsOptional()
  @IsEnum(UnitResidentRelationshipType)
  relationshipType?: UnitResidentRelationshipType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPaymentResponsible?: boolean;

  @ApiPropertyOptional({ enum: UnitResidentStatus })
  @IsOptional()
  @IsEnum(UnitResidentStatus)
  status?: UnitResidentStatus;
}
