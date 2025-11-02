import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, MinLength, Max, Min } from 'class-validator';

export class PackageDto {
  @ApiProperty({
    description: 'Package ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Package name',
    example: 'MfanisiGo',
  })
  name: string;
}

export class SchemeDto {
  @ApiProperty({
    description: 'Scheme ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Scheme name',
    example: 'Corporate Scheme',
  })
  name: string;

  @ApiProperty({
    description: 'Scheme description',
    example: 'Corporate insurance scheme for employees',
    required: false,
  })
  @IsOptional()
  description?: string;
}

export class PlanDto {
  @ApiProperty({
    description: 'Plan ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Plan name',
    example: 'Gold',
  })
  name: string;

  @ApiProperty({
    description: 'Plan description',
    example: 'Premium coverage plan',
    required: false,
  })
  @IsOptional()
  description?: string;
}

export class TagDto {
  @ApiProperty({
    description: 'Tag ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Tag name',
    example: 'corporate',
  })
  name: string;
}

export class CreateTagRequestDto {
  @ApiProperty({
    description: 'Tag name',
    example: 'corporate',
  })
  @IsString()
  @MinLength(1)
  name: string;
}

export class SearchTagsQueryDto {
  @ApiProperty({
    description: 'Search query (minimum 3 characters)',
    example: 'corp',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Search query must be at least 3 characters' })
  search?: string;

  @ApiProperty({
    description: 'Maximum number of results',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class PackagesResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-packages-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Packages retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Packages data',
    type: [PackageDto],
  })
  data: PackageDto[];
}

export class SchemesResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-schemes-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Schemes retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Schemes data',
    type: [SchemeDto],
  })
  data: SchemeDto[];
}

export class PlansResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-plans-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Plans retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Plans data',
    type: [PlanDto],
  })
  data: PlanDto[];
}

export class TagsResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-tags-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Tags retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Tags data',
    type: [TagDto],
  })
  data: TagDto[];
}

export class CreateTagResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 201,
  })
  status: number;

  @ApiProperty({
    description: 'Correlation ID from request',
    example: 'req-create-tag-12345',
  })
  correlationId: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Tag created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created tag data',
    type: TagDto,
  })
  data: TagDto;
}

