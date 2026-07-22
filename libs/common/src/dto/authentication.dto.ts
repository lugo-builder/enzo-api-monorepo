import { IsString, IsNumber } from 'class-validator';

export class AuthenticationDto {
  @IsString()
  accessToken: string;

  @IsString()
  refreshToken: string;

  @IsString()
  tokenType: string;

  @IsNumber()
  expiresIn: number;

  @IsString()
  partnerId: number;
}
