import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportBatchType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class JsonImportDto {
  @ApiProperty({ example: 'uuid-del-complejo-residencial-hydra' })
  @IsString()
  residentialComplexId: string;

  @ApiProperty({ enum: ImportBatchType, example: ImportBatchType.RESIDENTS })
  @IsEnum(ImportBatchType)
  type: ImportBatchType;

  @ApiProperty({
    description: 'Arreglo de filas a importar (mismo shape que CSV/XLSX).',
    type: 'array',
    items: { type: 'object' },
    example: [
      {
        unitNumber: '1',
        firstName: 'Juan',
        lastName: 'Pérez',
        fullName: 'Juan Pérez',
        email: 'juan@email.com',
        phone: '5512345678',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  rows: Record<string, any>[];

  @ApiPropertyOptional({ description: 'Etiqueta opcional del lote' })
  @IsOptional()
  @IsString()
  filename?: string;
}
