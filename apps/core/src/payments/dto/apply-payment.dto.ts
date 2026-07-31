import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class PaymentApplicationItemDto {
  @ApiProperty()
  @IsString()
  unitChargeId: string;

  @ApiProperty({ description: 'Decimal string, e.g. "500.00"' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a decimal string with up to 2 places' })
  amount: string;
}

export class ApplyPaymentDto {
  @ApiProperty({ type: [PaymentApplicationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentApplicationItemDto)
  applications: PaymentApplicationItemDto[];
}
