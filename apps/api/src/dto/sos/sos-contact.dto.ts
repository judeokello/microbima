import { ApiProperty } from '@nestjs/swagger';

/**
 * SOS Contact DTO
 *
 * Represents emergency contact information for insurance customers
 */
export class SosContactDto {
  @ApiProperty({
    description: 'Name of the emergency service',
    example: 'Ambulance Rescue Service 1',
  })
  name: string;

  @ApiProperty({
    description: 'Emergency contact phone number',
    example: '254711911911',
  })
  number: string;

  @ApiProperty({
    description: 'Type of emergency service',
    example: 'AmbulanceRescue',
  })
  serviceType: string;
}
