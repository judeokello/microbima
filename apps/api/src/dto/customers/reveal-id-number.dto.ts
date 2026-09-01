import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum IdNumberEntityKind {
  CUSTOMER = 'CUSTOMER',
  SPOUSE = 'SPOUSE',
  CHILD = 'CHILD',
  PARENT = 'PARENT',
  BENEFICIARY = 'BENEFICIARY',
}

export class RevealIdNumberRequestDto {
  @ApiProperty({
    description: 'Whose ID number to reveal',
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
}

export class RevealIdNumberDataDto {
  @ApiProperty({
    description: 'Full ID number',
    example: '12345678',
  })
  idNumber: string;
}

export class RevealIdNumberResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty({ example: 'req-123' })
  correlationId: string;

  @ApiProperty({ example: 'ID number retrieved successfully' })
  message: string;

  @ApiProperty({ type: RevealIdNumberDataDto })
  data: RevealIdNumberDataDto;
}
