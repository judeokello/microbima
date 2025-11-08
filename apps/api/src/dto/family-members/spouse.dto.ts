import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { IsDateStringFriendly } from '../../decorators/validators/is-date-string-friendly.decorator';

export class SpouseDto {
  @ApiProperty({
    description: 'First name of the spouse',
    example: 'Mary'
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the spouse',
    example: 'Doe'
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Middle name of the spouse',
    example: 'Elizabeth',
    required: false
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1988-12-05',
    required: false
  })
  @IsOptional()
  @IsDateStringFriendly()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Gender of the spouse',
    example: 'female',
    enum: ['male', 'female']
  })
  @IsIn(['male', 'female'])
  gender: string;

  @ApiProperty({
    description: 'Email address of the spouse',
    example: 'mary.doe@example.com',
    required: false
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Phone number of the spouse',
    example: '+254712345678',
    required: false
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Type of identification document',
    example: 'national',
    enum: ['national', 'alien', 'passport', 'birth_certificate', 'military'],
    required: false,
  })
  @ValidateIf((o) => o.idNumber !== undefined && o.idNumber !== null && o.idNumber !== '')
  @IsIn(['national', 'alien', 'passport', 'birth_certificate', 'military'])
  @IsOptional()
  idType?: string;

  @ApiProperty({
    description: 'Identification number',
    example: '11223344',
    required: false,
  })
  @ValidateIf((o) => o.idType !== undefined && o.idType !== null && o.idType !== '')
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiProperty({
    description: 'Verification status of the spouse',
    example: true,
    required: false
  })
  @IsOptional()
  isVerified?: boolean;

  @ApiProperty({
    description: 'When the spouse was verified',
    example: '2025-09-04T14:30:00Z',
    required: false
  })
  @IsOptional()
  @IsDateStringFriendly()
  verifiedAt?: string;

  @ApiProperty({
    description: 'Who verified the spouse (user ID)',
    example: 'user-12345',
    required: false
  })
  @IsOptional()
  @IsString()
  verifiedBy?: string;
}
