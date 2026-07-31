import { PartialType } from '@nestjs/swagger';
import { CreateWaterMeterDto } from './create-water-meter.dto';

export class UpdateWaterMeterDto extends PartialType(CreateWaterMeterDto) {}
