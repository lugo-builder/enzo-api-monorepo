import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class FindByRoleDto {
  @ApiProperty()
  @IsNotEmpty()
  roleId: string;
}
