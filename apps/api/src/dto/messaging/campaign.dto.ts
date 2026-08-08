import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum CampaignChannelDto {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
}

export enum AudienceModeDto {
  SCHEME_CUSTOMERS = 'SCHEME_CUSTOMERS',
  SCHEME_CONTACTS = 'SCHEME_CONTACTS',
  PASTE_LIST = 'PASTE_LIST',
}

export class CampaignAudienceDto {
  @ApiProperty({ enum: AudienceModeDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AudienceModeDto, { each: true })
  modes: AudienceModeDto[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  schemeIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  packageIds?: number[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerStatuses?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  policyStatuses?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Phones (SMS) or emails (EMAIL)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pasteList?: string[];
}

/** Compose request for preview and Send (OpenAPI CampaignComposeRequest). */
export class CampaignComposeRequestDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: CampaignChannelDto })
  @IsEnum(CampaignChannelDto)
  channel: CampaignChannelDto;

  @ApiPropertyOptional({ description: 'Required for EMAIL' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'SMS text or email HTML' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiProperty({ type: CampaignAudienceDto })
  @ValidateNested()
  @Type(() => CampaignAudienceDto)
  audience: CampaignAudienceDto;

  @ApiPropertyOptional({
    description: 'Must equal name when sendableCount >= confirm threshold',
  })
  @IsOptional()
  @IsString()
  confirmationName?: string;
}

export class PreflightRowDto {
  @ApiPropertyOptional({ nullable: true })
  customerName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  customerId?: string | null;

  @ApiProperty()
  error: string;
}

export class CampaignPreviewResponseDto {
  @ApiProperty()
  sendableCount: number;

  @ApiProperty()
  largeAudienceWarning: boolean;

  @ApiProperty()
  requiresNameConfirmation: boolean;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  perSchemeCounts: Array<{
    schemeId: number;
    schemeName: string;
    recipientCount: number;
  }>;

  @ApiPropertyOptional({ nullable: true })
  sample?: {
    customerId?: string | null;
    address: string;
    renderedSubject?: string | null;
    renderedBody: string;
    placeholderHighlights: Array<{ key: string; value: string; colorToken: string }>;
  } | null;

  @ApiProperty({ type: [PreflightRowDto] })
  blockingErrors: PreflightRowDto[];

  @ApiProperty({ type: [PreflightRowDto] })
  softSkips: PreflightRowDto[];

  @ApiProperty()
  characterCount: number;

  @ApiPropertyOptional({ nullable: true })
  smsSegmentCount?: number | null;
}
