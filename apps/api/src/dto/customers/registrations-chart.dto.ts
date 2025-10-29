import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsNumber } from 'class-validator';

export class ChartDataPointDto {
  @ApiProperty({
    description: 'Date for this data point',
    example: '2025-01-15',
  })
  @IsString()
  date: string;

  @ApiProperty({
    description: 'Number of customers registered on this date',
    example: 5,
  })
  @IsNumber()
  count: number;
}

export class RegistrationsChartResponseDto {
  @ApiProperty({
    description: 'Array of daily registration counts',
    type: [ChartDataPointDto],
  })
  @IsArray()
  data: ChartDataPointDto[];

  @ApiProperty({
    description: 'Total registrations in the period',
    example: 45,
  })
  @IsNumber()
  total: number;

  @ApiProperty({
    description: 'Period covered',
    example: '7d',
    enum: ['7d', '30d', '90d'],
  })
  @IsString()
  period: string;
}

