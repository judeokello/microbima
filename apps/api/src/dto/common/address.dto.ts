import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class AddressDto {
  @ApiProperty({
    description: 'Street address',
    example: '123 Main Street'
  })
  @IsString()
  street: string;

  @ApiProperty({
    description: 'City name',
    example: 'Nairobi'
  })
  @IsString()
  city: string;

  @ApiProperty({
    description: 'County/State name',
    example: 'Nairobi County',
    required: false
  })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiProperty({
    description: 'Postal code',
    example: '00100',
    required: false
  })
  @IsOptional()
  @IsString()
  postalCode?: string;
}
