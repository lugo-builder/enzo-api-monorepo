import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class RolUpdateDto {
  @IsUUID()
  @ApiProperty()
  @IsNotEmpty()
  roleId: string;
}
