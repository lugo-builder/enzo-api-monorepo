import { IsOptional, IsString } from 'class-validator';

export class EcommerceAuthorizationDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  verificationCode?: string;

  @IsString()
  @IsOptional()
  spApiOauthCode?: string;

  @IsString()
  @IsOptional()
  sellingPartnerId?: string;

  @IsString()
  @IsOptional()
  state?: string;
}
