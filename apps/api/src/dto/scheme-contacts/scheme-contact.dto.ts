import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsEmail } from 'class-validator';
import { IsKenyanPhone } from '../../decorators/validators/is-kenyan-phone.decorator';

export class CreateSchemeContactDto {
  @ApiProperty({
    description: 'Contact first name',
    example: 'John',
  })
  @IsString()
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    description: 'Contact other name',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  otherName?: string;

  @ApiProperty({
    description: 'Primary phone number (10 digits starting with 01 or 07)',
    example: '0712345678',
  })
  @IsString()
  @IsKenyanPhone()
  @MaxLength(15)
  phoneNumber: string;

  @ApiProperty({
    description: 'Secondary phone number (10 digits starting with 01 or 07)',
    example: '0123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsKenyanPhone()
  @MaxLength(15)
  phoneNumber2?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiProperty({
    description: 'Job designation/title',
    example: 'HR Manager',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Primary contact for scheme administration',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSchemeContactDto {
  @ApiProperty({
    description: 'Contact first name',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiProperty({
    description: 'Contact other name',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  otherName?: string;

  @ApiProperty({
    description: 'Primary phone number (10 digits starting with 01 or 07)',
    example: '0712345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsKenyanPhone()
  @MaxLength(15)
  phoneNumber?: string;

  @ApiProperty({
    description: 'Secondary phone number (10 digits starting with 01 or 07)',
    example: '0123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsKenyanPhone()
  @MaxLength(15)
  phoneNumber2?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiProperty({
    description: 'Job designation/title',
    example: 'HR Manager',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Primary contact for scheme administration',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SchemeContactDto {
  @ApiProperty({
    description: 'Contact ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Scheme ID',
    example: 1,
  })
  schemeId: number;

  @ApiProperty({
    description: 'Contact first name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'Contact other name',
    example: 'Doe',
    required: false,
  })
  otherName?: string | null;

  @ApiProperty({
    description: 'Primary phone number',
    example: '+254700123456',
    required: false,
  })
  phoneNumber?: string | null;

  @ApiProperty({
    description: 'Secondary phone number',
    example: '+254711234567',
    required: false,
  })
  phoneNumber2?: string | null;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
    required: false,
  })
  email?: string | null;

  @ApiProperty({
    description: 'Job designation/title',
    example: 'HR Manager',
    required: false,
  })
  designation?: string | null;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Primary contact for scheme administration',
    required: false,
  })
  notes?: string | null;

  @ApiProperty({
    description: 'User ID who created the contact',
    example: 'uuid-here',
  })
  createdBy: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00Z',
    required: false,
  })
  updatedAt?: Date | null;
}

export class SchemeContactResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-contact-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Contact retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Contact data',
    type: SchemeContactDto,
  })
  data: SchemeContactDto;
}

export class SchemeContactsListResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-contacts-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Contacts retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of contacts',
    type: [SchemeContactDto],
  })
  data: SchemeContactDto[];
}

