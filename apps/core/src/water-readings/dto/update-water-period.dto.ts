import { PartialType } from '@nestjs/swagger';
import { CreateWaterPeriodDto } from './create-water-period.dto';

export class UpdateWaterPeriodDto extends PartialType(CreateWaterPeriodDto) {}
