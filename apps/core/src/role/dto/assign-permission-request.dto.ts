import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class AssignPermissionToRoleDto {
  @ApiProperty()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty()
  @IsNotEmpty()
  permissionId: string;
}
