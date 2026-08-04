import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationEntityKind } from '@prisma/client';

export class CareOpsQueueEntityDto {
  @ApiProperty()
  customerId: string;

  @ApiProperty()
  customerName: string;

  @ApiPropertyOptional()
  customerPhone?: string | null;

  @ApiPropertyOptional()
  registrationId?: string | null;

  @ApiPropertyOptional()
  partnerId?: number | null;

  @ApiProperty({ enum: RegistrationEntityKind })
  entityKind: RegistrationEntityKind;

  @ApiPropertyOptional()
  entityId?: string | null;

  @ApiProperty()
  entityName: string;

  @ApiProperty({ type: [String] })
  missingFields: string[];

  @ApiProperty({ type: [String] })
  missingFieldLabels: string[];

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  middleName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  gender?: string | null;

  @ApiPropertyOptional()
  idType?: string | null;

  @ApiPropertyOptional()
  idNumber?: string | null;

  @ApiPropertyOptional()
  dateOfBirth?: string | null;
}

export class CareOpsQueueResponseDto {
  @ApiProperty({ type: [CareOpsQueueEntityDto] })
  items: CareOpsQueueEntityDto[];

  @ApiProperty()
  total: number;
}
