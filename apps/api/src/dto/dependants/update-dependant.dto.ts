import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsDateString, IsIn, ValidateIf, Length } from 'class-validator';

export class UpdateDependantDto {
  @ApiProperty({
    description: 'First name',
    example: 'Jane',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'Middle name',
    example: 'Marie',
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
    example: '1990-05-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'jane.doe@example.com',
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
  @ValidateIf((o) => o.idNumber !== undefined && o.idNumber !== null && o.idNumber !== '')
  @IsOptional()
  @IsIn(['national', 'alien', 'passport', 'birth_certificate', 'military'])
  idType?: string;

  @ApiProperty({
    description: 'ID number',
    example: '87654321',
    required: false,
  })
  @ValidateIf((o) => o.idType !== undefined && o.idType !== null && o.idType !== '')
  @IsOptional()
  @IsString()
  @Length(5, 9)
  idNumber?: string;
}

