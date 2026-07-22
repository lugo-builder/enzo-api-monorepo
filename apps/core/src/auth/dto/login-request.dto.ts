import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ClientApp } from '@app/common/enums/clientApp';

export class LogInRequestDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(11, { message: 'Password must be at least 11 characters long' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'Password must contain at least one special character',
  })
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  password: string;

  @ApiProperty({ enum: ClientApp, default: ClientApp.CLIENT })
  @IsEnum(ClientApp)
  @IsOptional()
  clientApp: ClientApp = ClientApp.CLIENT;
}
