import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO for creating a new partner via internal API
 * Used by internal admin operations
 */
export class CreatePartnerRequestDto {
  @ApiProperty({
    description: 'Partner name',
    example: 'Acme Insurance Ltd',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  partnerName: string;

  @ApiProperty({
    description: 'Partner website URL',
    example: 'https://acme-insurance.com',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiProperty({
    description: 'Partner office location',
    example: 'Nairobi, Kenya',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  officeLocation?: string;
}
