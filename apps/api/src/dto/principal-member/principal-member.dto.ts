import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsIn, IsOptional } from 'class-validator';
import { IsDateStringFriendly } from '../../decorators/validators/is-date-string-friendly.decorator';

export class PrincipalMemberDto {
  @ApiProperty({
    description: 'First name of the principal member',
    example: 'John'
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the principal member',
    example: 'Doe'
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Middle name of the principal member',
    example: 'Michael',
    required: false
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1985-06-15'
  })
  @IsDateStringFriendly()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Gender of the principal member',
    example: 'male',
    enum: ['male', 'female']
  })
  @IsIn(['male', 'female'])
  gender: string;

  @ApiProperty({
    description: 'Email address of the principal member',
    example: 'john.doe@example.com',
    required: false
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Phone number of the principal member',
    example: '+254712345678',
    required: false
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Type of identification document',
    example: 'national',
    enum: ['national', 'alien', 'passport', 'birth_certificate', 'military']
  })
  @IsIn(['national', 'alien', 'passport', 'birth_certificate', 'military'])
  idType: string;

  @ApiProperty({
    description: 'Identification number',
    example: '12345678'
  })
  @IsString()
  idNumber: string;

  @ApiProperty({
    description: 'Partner customer reference identifier. Can be any format (numeric, alphanumeric, UUID, etc.). This is what you\'ll use in subsequent API calls.',
    example: 'PARTNER-CUST-001'
  })
  @IsString()
  partnerCustomerId: string;
}
