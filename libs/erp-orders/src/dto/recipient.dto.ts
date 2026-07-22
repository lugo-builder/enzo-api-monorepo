import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RecipientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  email: string;
}
