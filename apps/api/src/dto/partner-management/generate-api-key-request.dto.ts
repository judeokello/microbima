import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

/**
 * DTO for generating API key via internal API
 */
export class GenerateApiKeyRequestDto {
  @ApiProperty({
    description: 'Partner ID for which to generate API key (numeric value)',
    example: 1,
  })
  @IsNumber({}, { message: 'partnerId must be a numeric value' })
  @IsNotEmpty({ message: 'partnerId is required' })
  partnerId: number;
}
