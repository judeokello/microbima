import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, ValidateIf, Length, IsEnum } from 'class-validator';
import { IsDateStringFriendly } from '../../decorators/validators/is-date-string-friendly.decorator';
import { ParentRelationship } from '@prisma/client';

export class UpdateParentDto {
  @ApiProperty({ description: 'First name', example: 'Jane', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'Middle name', example: 'Ann', required: false })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1960-05-12',
    required: false,
  })
  @IsOptional()
  @IsDateStringFriendly()
  dateOfBirth?: string;

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
    description: 'Identification number',
    example: '11223344',
    required: false,
  })
  @ValidateIf((o) => o.idType !== undefined && o.idType !== null && o.idType !== '')
  @IsOptional()
  @IsString()
  @Length(5, 9)
  idNumber?: string;

  @ApiProperty({
    description: 'Relationship to the principal member',
    enum: ParentRelationship,
    example: ParentRelationship.MOTHER,
    required: false,
  })
  @IsOptional()
  @IsEnum(ParentRelationship)
  relationship?: ParentRelationship;
}
