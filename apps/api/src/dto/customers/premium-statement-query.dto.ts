import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/** Query params for premium statement PDF (same date semantics as payments list). */
export class PremiumStatementQueryDto {
  @ApiProperty({ required: false, description: 'Filter from expected payment date (YYYY-MM-DD), UTC start of day' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ required: false, description: 'Filter to expected payment date (YYYY-MM-DD), UTC end of day' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
