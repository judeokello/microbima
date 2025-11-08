import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class DashboardStatsDto {
  @ApiProperty({
    description: 'Total number of brand ambassadors',
    example: 12
  })
  @IsNumber()
  totalAgents: number;

  @ApiProperty({
    description: 'Number of active brand ambassadors',
    example: 10
  })
  @IsNumber()
  activeAgents: number;

  @ApiProperty({
    description: 'Total number of customers',
    example: 1234
  })
  @IsNumber()
  totalCustomers: number;

  @ApiProperty({
    description: 'Number of registrations today',
    example: 15
  })
  @IsNumber()
  registrationsToday: number;

  @ApiProperty({
    description: 'Number of customers with pending missing requirements',
    example: 45
  })
  @IsNumber()
  pendingMRs: number;

  @ApiProperty({
    description: 'Active agent rate as percentage',
    example: 83
  })
  @IsNumber()
  activeAgentRate: number;
}
