import { PartialType } from '@nestjs/swagger';
import { CreateBillingPeriodDto } from './create-billing-period.dto';

export class UpdateBillingPeriodDto extends PartialType(CreateBillingPeriodDto) {}
