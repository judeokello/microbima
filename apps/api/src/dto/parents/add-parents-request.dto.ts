import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ParentDto } from '../family-members/parent.dto';

export class AddParentsRequestDto {
  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req-12345-67890',
  })
  @IsString()
  correlationId: string;

  @ApiProperty({
    description: 'Parent / parent-in-law records to add',
    type: [ParentDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParentDto)
  parents: ParentDto[];
}
