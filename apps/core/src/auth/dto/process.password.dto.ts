import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';


export class ProcessPasswordDto {
@IsString()
@ApiProperty()
@IsNotEmpty()
@MinLength(11, { message: 'Password must be at least 11 characters long' })
@Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
@Matches(/[!@#$%^&*(),.?":{}|<>]/, { message: 'Password must contain at least one special character' })
@Matches(/\d/, { message: 'Password must contain at least one number' })
password: string;
}