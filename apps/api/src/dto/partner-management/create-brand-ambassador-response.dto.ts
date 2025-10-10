import { ApiProperty } from '@nestjs/swagger';

export class CreateBrandAmbassadorResponseDto {
  @ApiProperty({
    description: 'Brand Ambassador ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Supabase User ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  userId: string;

  @ApiProperty({
    description: 'Partner ID',
    example: 1,
  })
  partnerId: number;

  @ApiProperty({
    description: 'Brand Ambassador display name',
    example: 'John Doe',
  })
  displayName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+254700000000',
    required: false,
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Rate per registration in cents',
    example: 500,
  })
  perRegistrationRateCents: number;

  @ApiProperty({
    description: 'Whether the Brand Ambassador is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}





