import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddedDependantDto {
  @ApiProperty({
    description: 'Database ID of the created dependant',
    example: '1234567890'
  })
  @IsString()
  dependantId: string;

  @ApiProperty({
    description: 'Relationship type',
    enum: ['child', 'spouse'],
    example: 'child'
  })
  @IsString()
  relationship: 'child' | 'spouse';

  @ApiProperty({
    description: 'First name',
    example: 'Tommy'
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe'
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '2010-05-15'
  })
  @IsString()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Gender',
    enum: ['male', 'female'],
    example: 'male'
  })
  @IsString()
  gender: string;

  @ApiProperty({
    description: 'Email address (for spouses)',
    example: 'jane.doe@example.com',
    required: false
  })
  email?: string;

  @ApiProperty({
    description: 'ID type (for spouses)',
    example: 'national',
    required: false
  })
  idType?: string;

  @ApiProperty({
    description: 'ID number (for spouses)',
    example: '87654321',
    required: false
  })
  idNumber?: string;
}

export class DependantsSummaryDto {
  @ApiProperty({
    description: 'Total number of dependants processed',
    example: 5
  })
  @IsNumber()
  totalProcessed: number;

  @ApiProperty({
    description: 'Number of children added',
    example: 3
  })
  @IsNumber()
  childrenAdded: number;

  @ApiProperty({
    description: 'Number of spouses added',
    example: 2
  })
  @IsNumber()
  spousesAdded: number;

  @ApiProperty({
    description: 'Whether all dependants were added successfully',
    example: true
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Result message',
    example: '3 children and 2 spouses added successfully'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Array of successfully added dependants with their IDs',
    type: [AddedDependantDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddedDependantDto)
  addedDependants: AddedDependantDto[];
}

export class AddDependantsResponseDataDto {
  @ApiProperty({
    description: 'Partner customer ID',
    example: 'CUST-2024-001'
  })
  @IsString()
  partnerCustomerId: string;

  @ApiProperty({
    description: 'Dependants processing summary',
    type: DependantsSummaryDto
  })
  @ValidateNested()
  @Type(() => DependantsSummaryDto)
  dependants: DependantsSummaryDto;
}

export class AddDependantsResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 201
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-add-dependants-12345'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Dependants added successfully'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Response data',
    type: AddDependantsResponseDataDto
  })
  @ValidateNested()
  @Type(() => AddDependantsResponseDataDto)
  data: AddDependantsResponseDataDto;
}
