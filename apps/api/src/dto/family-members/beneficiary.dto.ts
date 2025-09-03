import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsDateString, IsIn, IsOptional, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from '../common/address.dto';

export class BeneficiaryDto {
  @ApiProperty({
    description: 'First name of the beneficiary',
    example: 'Sarah'
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the beneficiary',
    example: 'Johnson'
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Middle name of the beneficiary',
    example: 'Grace',
    required: false
  })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1990-08-15'
  })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Gender of the beneficiary',
    example: 'female',
    enum: ['male', 'female']
  })
  @IsIn(['male', 'female'])
  gender: string;

  @ApiProperty({
    description: 'Relationship to the principal member',
    example: 'spouse',
    enum: ['spouse', 'child', 'parent', 'sibling', 'friend', 'other']
  })
  @IsIn(['spouse', 'child', 'parent', 'sibling', 'friend', 'other'])
  relationship: string;

  @ApiProperty({
    description: 'Required when relationship is \'other\'',
    example: 'Life partner',
    required: false
  })
  @IsOptional()
  @IsString()
  relationshipDescription?: string;

  @ApiProperty({
    description: 'Email address of the beneficiary',
    example: 'sarah.johnson@example.com',
    required: false
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Phone number of the beneficiary (Kenyan phone number format)',
    example: '+254712345678',
    required: false
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Type of identification document',
    example: 'national',
    enum: ['national', 'alien', 'passport', 'birth_certificate']
  })
  @IsIn(['national', 'alien', 'passport', 'birth_certificate'])
  idType: string;

  @ApiProperty({
    description: 'Identification number',
    example: '12345678'
  })
  @IsString()
  idNumber: string;

  @ApiProperty({
    description: 'Percentage of benefits this beneficiary will receive',
    example: 50,
    minimum: 1,
    maximum: 100
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  percentage: number;

  @ApiProperty({
    description: 'Address information of the beneficiary',
    type: AddressDto,
    required: false
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
