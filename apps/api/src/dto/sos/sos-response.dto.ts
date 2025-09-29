import { ApiProperty } from '@nestjs/swagger';
import { SosContactDto } from './sos-contact.dto';

// Re-export SosContactDto for convenience
export { SosContactDto };

/**
 * SOS Response Data DTO
 */
export class SosResponseDataDto {
  @ApiProperty({
    description: 'List of emergency contacts',
    type: [SosContactDto],
  })
  sosContacts: SosContactDto[];
}

/**
 * SOS Response DTO
 *
 * Response format for emergency contacts endpoint
 */
export class SosResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'SOS contacts retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'SOS contacts data',
    type: SosResponseDataDto,
  })
  data: SosResponseDataDto;
}
