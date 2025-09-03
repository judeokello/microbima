import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsDateString, IsIn, IsOptional } from 'class-validator';

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
    example: '1988-12-05'
  })
  @IsDateString()
  dateOfBirth: string;

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
    description: 'Type of identification document',
    example: 'national',
    enum: ['national', 'alien', 'passport']
  })
  @IsIn(['national', 'alien', 'passport'])
  idType: string;

  @ApiProperty({
    description: 'Identification number',
    example: '11223344'
  })
  @IsString()
  idNumber: string;
}
