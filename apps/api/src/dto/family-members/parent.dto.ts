import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, ValidateIf, Length, IsEnum } from 'class-validator';
import { IsDateStringFriendly } from '../../decorators/validators/is-date-string-friendly.decorator';
import { ParentRelationship } from '@prisma/client';

export class ParentDto {
  @ApiProperty({ description: 'First name', example: 'Jane' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Middle name', example: 'Ann', required: false })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1960-05-12',
  })
  @IsDateStringFriendly()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Gender',
    example: 'female',
    enum: ['male', 'female'],
  })
  @IsIn(['male', 'female'])
  gender: string;

  @ApiProperty({
    description: 'ID type',
    example: 'national',
    enum: ['national', 'alien', 'passport', 'birth_certificate', 'military'],
  })
  @ValidateIf((o) => o.idNumber !== undefined && o.idNumber !== null && o.idNumber !== '')
  @IsIn(['national', 'alien', 'passport', 'birth_certificate', 'military'])
  idType: string;

  @ApiProperty({
    description: 'Identification number',
    example: '11223344',
  })
  @ValidateIf((o) => o.idType !== undefined && o.idType !== null && o.idType !== '')
  @IsString()
  @Length(5, 9)
  idNumber: string;

  @ApiProperty({
    description: 'Relationship to the principal member',
    enum: ParentRelationship,
    example: ParentRelationship.MOTHER,
  })
  @IsEnum(ParentRelationship)
  relationship: ParentRelationship;
}
