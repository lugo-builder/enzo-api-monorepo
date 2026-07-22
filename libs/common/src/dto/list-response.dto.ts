import { ApiProperty } from '@nestjs/swagger';

export class ListResponseDto<ItemType> {
  @ApiProperty()
  totalRecords: number;

  @ApiProperty({ type: [Object] })
  data: ItemType[];
}
