import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsIn, IsOptional } from 'class-validator';

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
    example: '2010-08-12'
  })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Gender of the child',
    example: 'male',
    enum: ['male', 'female']
  })
  @IsIn(['male', 'female'])
  gender: string;

  @ApiProperty({
    description: 'Type of identification document for children - birth certificate numbers or national IDs (for 18+ children)',
    example: 'birthCertificateNumber',
    enum: ['birthCertificateNumber', 'national'],
    required: false
  })
  @IsOptional()
  @IsIn(['birthCertificateNumber', 'national'])
  idType?: string;

  @ApiProperty({
    description: 'Identification number corresponding to the birth certificate',
    example: '123456789',
    required: false
  })
  @IsOptional()
  @IsString()
  idNumber?: string;
}
