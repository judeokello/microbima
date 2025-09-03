import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for generating API key via internal API
 */
export class GenerateApiKeyRequestDto {
  @ApiProperty({
    description: 'Partner ID for which to generate API key',
    example: 'partner_123456789',
  })
  @IsString()
  @IsNotEmpty()
  partnerId: string;
}
