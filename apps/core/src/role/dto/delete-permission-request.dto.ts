import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class DeletePermissionToRoleDto {
  @ApiProperty()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty()
  @IsNotEmpty()
  permissionId: string;
}
