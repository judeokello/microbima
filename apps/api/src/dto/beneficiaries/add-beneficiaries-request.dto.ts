import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BeneficiaryDto } from '../family-members/beneficiary.dto';

export class AddBeneficiariesRequestDto {
  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req-add-beneficiaries-12345'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Array of beneficiaries to add',
    type: [BeneficiaryDto],
    minItems: 1
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeneficiaryDto)
  beneficiaries: BeneficiaryDto[];
}
