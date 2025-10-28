import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, ValidateNested, MaxLength, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductDto } from '../common/product.dto';
import { PrincipalMemberDto } from './principal-member.dto';
import { BeneficiaryDto } from '../family-members/beneficiary.dto';
import { ChildDto } from '../family-members/child.dto';
import { SpouseDto } from '../family-members/spouse.dto';

export class CreatePrincipalMemberRequestDto {
  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req-12345-67890'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Product and plan selection',
    type: ProductDto
  })
  @ValidateNested()
  @Type(() => ProductDto)
  product: ProductDto;

  @ApiProperty({
    description: 'Principal member information',
    type: PrincipalMemberDto
  })
  @ValidateNested()
  @Type(() => PrincipalMemberDto)
  principalMember: PrincipalMemberDto;

  @ApiProperty({
    description: 'Optional array of beneficiaries for the principal member',
    type: [BeneficiaryDto],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeneficiaryDto)
  beneficiaries?: BeneficiaryDto[];

  @ApiProperty({
    description: 'Optional array of children for the principal member',
    type: [ChildDto],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildDto)
  children?: ChildDto[];

  @ApiProperty({
    description: 'Optional array of spouses for the principal member',
    type: [SpouseDto],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpouseDto)
  spouses?: SpouseDto[];

  @ApiProperty({
    description: 'Optional referral information indicating who referred this principal member',
    example: 'Agent Smith',
    maxLength: 50,
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referredBy?: string;

  @ApiProperty({
    description: 'Package scheme ID to assign customer to. Defaults to 1 if not provided.',
    example: 1,
    required: false
  })
  @IsOptional()
  @IsNumber()
  packageSchemeId?: number;
}
