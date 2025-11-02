import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsDateString, IsIn } from 'class-validator';

export class UpdateCustomerDto {
  @ApiProperty({
    description: 'First name',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'Middle name',
    example: 'Michael',
    required: false,
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1985-06-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
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
    example: 'male',
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
    example: '12345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  idNumber?: string;
}


