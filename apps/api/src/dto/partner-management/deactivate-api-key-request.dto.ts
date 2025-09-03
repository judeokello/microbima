import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for deactivating API key via public API
 */
export class DeactivateApiKeyRequestDto {
  @ApiProperty({
    description: 'API key to deactivate',
    example: 'mb_abc123def456...',
  })
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
