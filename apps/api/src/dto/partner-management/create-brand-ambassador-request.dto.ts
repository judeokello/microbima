import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsInt, IsOptional, IsBoolean, Min, IsEmail, IsArray } from 'class-validator';

export class CreateBrandAmbassadorRequestDto {
  @ApiProperty({
    description: 'Email address for the new user',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password for the new user',
    example: 'securePassword123',
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'User roles',
    example: ['brand_ambassador'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  roles: string[];

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

  @ApiProperty({
    description: 'User ID of the admin who created this Brand Ambassador',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  createdBy?: string;
}





