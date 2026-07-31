import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitResidentRelationshipType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { CreateResidentDto } from './create-resident.dto';

export class CreateUnitResidentDto {
  @ApiPropertyOptional({
    description: 'Existing resident id. Omit and provide `resident` to create a new one.',
  })
  @IsOptional()
  @IsString()
  residentId?: string;

  @ApiPropertyOptional({
    description: 'Inline resident payload used when residentId is not provided.',
    type: CreateResidentDto,
  })
  @IsOptional()
  @ValidateIf((o) => !o.residentId)
  resident?: CreateResidentDto;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
