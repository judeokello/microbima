import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { IsDateStringFriendly } from '../../decorators/validators/is-date-string-friendly.decorator';

export class ChildDto {
  @ApiProperty({
    description: 'First name of the child',
    example: 'Tommy'
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the child',
    example: 'Doe'
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Middle name of the child',
    example: 'James',
    required: false
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '2010-08-12',
    required: false
  })
  @IsOptional()
  @IsDateStringFriendly()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Gender of the child',
    example: 'male',
    enum: ['male', 'female']
  })
  @IsIn(['male', 'female'])
  gender: string;

  @ApiProperty({
    description: 'Type of identification document for children - birth certificate numbers or national IDs (for 18+ children)',
    example: 'birth_certificate',
    enum: ['national', 'alien', 'passport', 'birth_certificate', 'military'],
    required: false
  })
  @IsOptional()
  @IsIn(['national', 'alien', 'passport', 'birth_certificate', 'military'])
  idType?: string;

  @ApiProperty({
    description: 'Identification number corresponding to the birth certificate',
    example: '123456789',
    required: false
  })
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiProperty({
    description: 'Verification status of the child',
    example: true,
    required: false
  })
  @IsOptional()
  isVerified?: boolean;

  @ApiProperty({
    description: 'When the child was verified',
    example: '2025-09-04T14:30:00Z',
    required: false
  })
  @IsOptional()
  @IsDateStringFriendly()
  verifiedAt?: string;

  @ApiProperty({
    description: 'Who verified the child (user ID)',
    example: 'user-12345',
    required: false
  })
  @IsOptional()
  @IsString()
  verifiedBy?: string;
}
