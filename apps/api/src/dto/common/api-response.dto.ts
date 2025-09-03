import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200
  })
  @IsNumber()
  status: number;

  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'req-12345-67890',
    required: false,
    nullable: true
  })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
    required: false
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'Response data',
    required: false
  })
  @IsOptional()
  data?: T;
}
