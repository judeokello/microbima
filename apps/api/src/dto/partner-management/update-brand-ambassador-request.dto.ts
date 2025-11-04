import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsBoolean, Min, IsString, IsArray } from 'class-validator';

export class UpdateBrandAmbassadorRequestDto {
  @ApiProperty({
    description: 'Partner ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  partnerId?: number;

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
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  perRegistrationRateCents?: number;

  @ApiProperty({
    description: 'Whether the Brand Ambassador is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'User roles',
    example: ['brand_ambassador'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}

