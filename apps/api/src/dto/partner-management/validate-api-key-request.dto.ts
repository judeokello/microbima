import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for validating API key via public API
 */
export class ValidateApiKeyRequestDto {
  @ApiProperty({
    description: 'API key to validate',
    example: 'mb_abc123def456...',
  })
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
