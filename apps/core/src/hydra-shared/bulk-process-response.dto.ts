import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkProcessErrorDto {
  @ApiPropertyOptional()
  row?: number;

  @ApiPropertyOptional()
  unitNumber?: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  message: string;
}

export class BulkProcessSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  processed: number;

  @ApiProperty()
  failed: number;
}

export class BulkProcessResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: BulkProcessSummaryDto })
  summary: BulkProcessSummaryDto;

  @ApiProperty({ type: [BulkProcessErrorDto] })
  errors: BulkProcessErrorDto[];
}

export function bulkResponse(
  total: number,
  processed: number,
  errors: BulkProcessErrorDto[],
): BulkProcessResponseDto {
  return {
    success: errors.length === 0,
    summary: {
      total,
      processed,
      failed: errors.length,
    },
    errors,
  };
}
