import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class DashboardQueryDto {
  @ApiProperty()
  @IsString()
  residentialComplexId: string;
}

export class DashboardPeriodQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  month?: number;
}
