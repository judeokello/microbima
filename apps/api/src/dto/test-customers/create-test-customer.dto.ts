import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class CreateTestCustomerDto {
  @ApiProperty({
    description: 'Display name for the test user',
    example: 'Test User 1',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Phone number (will be normalized to 254XXXXXXXXX)',
    example: '254711234567',
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  @Matches(/^[\d+\s-]+$/, {
    message: 'Phone number must contain only digits, plus, spaces, or dashes',
  })
  phoneNumber!: string;
}
