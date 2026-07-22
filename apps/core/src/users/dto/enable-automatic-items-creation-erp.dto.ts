import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class EnableAutomaticItemsCreationInErpDto {
  @ApiProperty({
    description: 'Habilitar creación automática de items en ERP',
    example: true,
    type: Boolean,
  })
  @IsBoolean()
  @IsNotEmpty()
  enableAutomaticItemsCreationInErp: boolean;
}