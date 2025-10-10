import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateBrandAmbassadorRequestDto {
  @ApiProperty({
    description: 'Supabase User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Brand Ambassador display name',
    example: 'John Doe',
  })
  @IsString()
  displayName: string;

  @ApiProperty({
    description: 'Phone number (optional)',
    example: '+254700000000',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Rate per registration in cents',
    example: 500,
  })
  @IsInt()
  @Min(0)
  perRegistrationRateCents: number;

  @ApiProperty({
    description: 'Whether the Brand Ambassador is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}





