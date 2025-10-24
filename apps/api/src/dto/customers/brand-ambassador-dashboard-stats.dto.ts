import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class BrandAmbassadorDashboardStatsDto {
  @ApiProperty({
    description: 'Number of customers registered by the logged-in user today',
    example: 5,
  })
  @IsNumber()
  registeredToday: number;

  @ApiProperty({
    description: 'Number of customers registered by the logged-in user yesterday',
    example: 3,
  })
  @IsNumber()
  registeredYesterday: number;

  @ApiProperty({
    description: 'Total customers registered by the logged-in user this week',
    example: 20,
  })
  @IsNumber()
  registeredThisWeek: number;

  @ApiProperty({
    description: 'Total customers registered by the logged-in user last week',
    example: 18,
  })
  @IsNumber()
  registeredLastWeek: number;

  @ApiProperty({
    description: 'Total number of customers registered by the logged-in user',
    example: 150,
  })
  @IsNumber()
  myTotalRegistrations: number;
}





