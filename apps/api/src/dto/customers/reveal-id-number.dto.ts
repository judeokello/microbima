import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum IdNumberEntityKind {
  CUSTOMER = 'CUSTOMER',
  SPOUSE = 'SPOUSE',
  CHILD = 'CHILD',
  PARENT = 'PARENT',
  BENEFICIARY = 'BENEFICIARY',
}

export enum PiiRevealField {
  ID_NUMBER = 'ID_NUMBER',
  PHONE = 'PHONE',
  DATE_OF_BIRTH = 'DATE_OF_BIRTH',
}

export class RevealIdNumberRequestDto {
  @ApiProperty({
    description: 'Whose value to reveal',
    enum: IdNumberEntityKind,
    example: IdNumberEntityKind.CUSTOMER,
  })
  @IsEnum(IdNumberEntityKind)
  entityKind: IdNumberEntityKind;

  @ApiPropertyOptional({
    description: 'Spouse, child, parent, or beneficiary ID. Omit for the principal customer.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Which field to reveal. Defaults to ID_NUMBER.',
    enum: PiiRevealField,
    example: PiiRevealField.ID_NUMBER,
  })
  @IsOptional()
  @IsEnum(PiiRevealField)
  field?: PiiRevealField;
}

export class RevealIdNumberDataDto {
  @ApiProperty({
    description: 'Full unmasked value',
    example: '12345678',
  })
  value: string;

  @ApiPropertyOptional({
    description: 'Full ID number when field is ID_NUMBER',
    example: '12345678',
  })
  idNumber?: string;
}

export class RevealIdNumberResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty({ example: 'req-123' })
  correlationId: string;

  @ApiProperty({ example: 'Value retrieved successfully' })
  message: string;

  @ApiProperty({ type: RevealIdNumberDataDto })
  data: RevealIdNumberDataDto;
}
