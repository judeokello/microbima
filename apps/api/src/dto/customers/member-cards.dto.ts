import { ApiProperty } from '@nestjs/swagger';

export class MemberCardDataDto {
  @ApiProperty({ description: 'Scheme name' })
  schemeName: string;

  @ApiProperty({ description: 'Full name of the principal (policy holder)' })
  principalMemberName: string;

  @ApiProperty({ description: 'Full name of the person this card is for' })
  insuredMemberName: string;

  @ApiProperty({
    description: 'Member number; null when not yet assigned',
    nullable: true,
  })
  memberNumber: string | null;

  @ApiProperty({ description: 'Date of birth DD/MM/YYYY' })
  dateOfBirth: string;

  @ApiProperty({ description: 'Date printed DD/MM/YYYY' })
  datePrinted: string;
}

export class MemberCardsByPolicyItemDto {
  @ApiProperty({ description: 'Policy UUID' })
  policyId: string;

  @ApiProperty({ description: 'Policy number', nullable: true })
  policyNumber: string | null;

  @ApiProperty({ description: 'Package id' })
  packageId: number;

  @ApiProperty({ description: 'Package name' })
  packageName: string;

  @ApiProperty({
    description: 'Package\'s card template name; null means use default',
    nullable: true,
  })
  cardTemplateName: string | null;

  @ApiProperty({ description: 'Scheme name for this policy' })
  schemeName: string;

  @ApiProperty({ description: 'Card data for principal', type: MemberCardDataDto })
  principal: MemberCardDataDto;

  @ApiProperty({
    description: 'Card data for each dependant',
    type: [MemberCardDataDto],
  })
  dependants: MemberCardDataDto[];
}

export class MemberCardsResponseDto {
  @ApiProperty({
    description: 'Member cards grouped by policy',
    type: [MemberCardsByPolicyItemDto],
  })
  memberCardsByPolicy: MemberCardsByPolicyItemDto[];
}
