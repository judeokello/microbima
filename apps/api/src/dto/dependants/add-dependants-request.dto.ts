import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChildDto } from '../family-members/child.dto';
import { SpouseDto } from '../family-members/spouse.dto';

export class AddDependantsRequestDto {
  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req-add-dependants-12345'
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Optional array of children to add',
    type: [ChildDto],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildDto)
  children?: ChildDto[];

  @ApiProperty({
    description: 'Optional array of spouses to add',
    type: [SpouseDto],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpouseDto)
  spouses?: SpouseDto[];
}
