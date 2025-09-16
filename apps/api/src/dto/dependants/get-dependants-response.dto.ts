import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChildDto } from '../family-members/child.dto';
import { SpouseDto } from '../family-members/spouse.dto';

export class DependantWithIdDto {
  @ApiProperty({
    description: 'Database ID of the dependant',
    example: '1234567890'
  })
  @IsString()
  dependantId: string;

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

export class GetDependantsDataDto {
  @ApiProperty({
    description: 'Partner customer ID',
    example: 'CUST-2024-001'
  })
  @IsString()
  partnerCustomerId: string;

  @ApiProperty({
    description: 'Dependants information',
    type: 'object',
    properties: {
      children: {
        type: 'array',
        items: { $ref: '#/components/schemas/DependantWithIdDto' }
      },
      spouses: {
        type: 'array',
        items: { $ref: '#/components/schemas/DependantWithIdDto' }
      },
      totalDependants: {
        type: 'number',
        example: 2
      }
    }
  })
  dependants: {
    children: DependantWithIdDto[];
    spouses: DependantWithIdDto[];
    totalDependants: number;
  };
}

export class GetDependantsResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-get-dependants-12345'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Dependants retrieved successfully'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Response data',
    type: GetDependantsDataDto
  })
  @ValidateNested()
  @Type(() => GetDependantsDataDto)
  data: GetDependantsDataDto;
}
