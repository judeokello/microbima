import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdatePackageSchemeRequestDto {
  @ApiProperty({
    description: 'Waiting period in days (0-9999) for this package-scheme link',
    example: 30,
  })
  @IsInt()
  @Min(0)
  @Max(9999)
  generalSchemeWaitingPeriod: number;
}

export class PackageSchemeDetailDto {
  @ApiProperty({ example: 1 })
  packageSchemeId: number;

  @ApiProperty({ example: 1 })
  packageId: number;

  @ApiProperty({ example: 1 })
  schemeId: number;

  @ApiProperty({ example: 30, nullable: true })
  generalSchemeWaitingPeriod: number | null;
}

export class PackageSchemeDetailResponseDto {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty({ example: 'req-123' })
  correlationId: string;

  @ApiProperty({ example: 'Package scheme updated successfully' })
  message: string;

  @ApiProperty({ type: PackageSchemeDetailDto })
  data: PackageSchemeDetailDto;
}
