import { PartialType } from '@nestjs/swagger';
import { CreateResidentialComplexDto } from './create-residential-complex.dto';

export class UpdateResidentialComplexDto extends PartialType(CreateResidentialComplexDto) {}
