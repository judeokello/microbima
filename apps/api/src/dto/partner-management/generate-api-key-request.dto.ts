import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

/**
 * DTO for generating API key via internal API
 */
export class GenerateApiKeyRequestDto {
  @ApiProperty({
    description: 'Partner ID for which to generate API key',
    example: 'partner_123456789',
  })
  @IsNumber()
  @IsNotEmpty()
  partnerId: number;
}
