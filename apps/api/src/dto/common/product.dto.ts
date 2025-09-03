import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ProductDto {
  @ApiProperty({
    description: 'Product identifier',
    example: 'mfanisi-go'
  })
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Plan identifier',
    example: 'basic'
  })
  @IsString()
  planId: string;
}
