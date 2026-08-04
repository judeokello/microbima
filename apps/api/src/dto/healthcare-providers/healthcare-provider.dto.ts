import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PackageProviderPanelSummaryDto {
  @ApiProperty({ example: 1 })
  packageId: number;

  @ApiProperty({ example: 'MfanisiGo' })
  packageName: string;

  @ApiPropertyOptional({ example: 'mfanisi-go', nullable: true })
  packageSlug: string | null;

  @ApiProperty({ example: 789, description: 'Active providers on this package panel' })
  providerCount: number;
}

export class PackageProviderPanelListResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty({ example: 'req-123' })
  correlationId: string;

  @ApiProperty({ example: 'Package provider panels retrieved successfully' })
  message: string;

  @ApiProperty({ type: [PackageProviderPanelSummaryDto] })
  data: PackageProviderPanelSummaryDto[];
}

export class HealthcareProviderListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'BLISS GVS HEALTHCARE - KABARNET' })
  name: string;

  @ApiProperty({ example: 30 })
  countyId: number;

  @ApiProperty({ example: 'Baringo' })
  countyName: string;

  @ApiPropertyOptional({ example: 12, nullable: true })
  subCountyId: number | null;

  @ApiPropertyOptional({ example: 'Baringo Central', nullable: true })
  subCountyName: string | null;

  @ApiPropertyOptional({ example: -0.1234567, nullable: true })
  latitude: number | null;

  @ApiPropertyOptional({ example: 36.1234567, nullable: true })
  longitude: number | null;

  @ApiProperty({ example: 'LCT Africa' })
  sourceName: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class HealthcareProviderListResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty({ example: 'req-123' })
  correlationId: string;

  @ApiProperty({ example: 'Package providers retrieved successfully' })
  message: string;

  @ApiProperty({ type: [HealthcareProviderListItemDto] })
  data: HealthcareProviderListItemDto[];

  @ApiProperty({
    example: {
      page: 1,
      pageSize: 20,
      totalItems: 789,
      totalPages: 40,
      hasNextPage: true,
      hasPreviousPage: false,
    },
  })
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
