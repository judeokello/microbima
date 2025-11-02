import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsDateString, IsIn, IsNumber, Min, Max } from 'class-validator';

export class UpdateBeneficiaryDto {
  @ApiProperty({
    description: 'First name',
    example: 'Sarah',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'Middle name',
    example: 'Ann',
    required: false,
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Johnson',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1988-03-20',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'sarah.johnson@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+254712345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Gender',
    example: 'female',
    enum: ['male', 'female'],
    required: false,
  })
  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: string;

  @ApiProperty({
    description: 'ID type',
    example: 'national',
    enum: ['national', 'alien', 'passport', 'birth_certificate', 'military'],
    required: false,
  })
  @IsOptional()
  @IsIn(['national', 'alien', 'passport', 'birth_certificate', 'military'])
  idType?: string;

  @ApiProperty({
    description: 'ID number',
    example: '98765432',
    required: false,
  })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiProperty({
    description: 'Relationship to principal member',
    example: 'spouse',
    required: false,
  })
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiProperty({
    description: 'Relationship description (if relationship is "other")',
    example: 'Life partner',
    required: false,
  })
  @IsOptional()
  @IsString()
  relationshipDescription?: string;

  @ApiProperty({
    description: 'Percentage of benefits (1-100)',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  percentage?: number;
}


