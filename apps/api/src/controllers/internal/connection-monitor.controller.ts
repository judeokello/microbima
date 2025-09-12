import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Connection Monitor')
@Controller('internal/connection-monitor')
export class ConnectionMonitorController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get database connection statistics' })
  @ApiResponse({ status: 200, description: 'Connection statistics retrieved successfully' })
  async getConnectionStats() {
    try {
      // Get basic connection info
      const connectionInfo = await this.prismaService.$queryRaw<Array<{
        total_connections: number;
        active_connections: number;
        idle_connections: number;
        idle_in_transaction: number;
      }>>`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      // Get connection limit info
      const limitInfo = await this.prismaService.$queryRaw<Array<{
        max_connections: string;
      }>>`
        SELECT 
          setting as max_connections
        FROM pg_settings 
        WHERE name = 'max_connections'
      `;

      // Get current database name
      const dbInfo = await this.prismaService.$queryRaw<Array<{
        database_name: string;
      }>>`
        SELECT current_database() as database_name
      `;

      return {
        timestamp: new Date().toISOString(),
        database: dbInfo[0]?.database_name || 'unknown',
        connections: connectionInfo[0] || {},
        limits: limitInfo[0] || {},
        recommendations: this.getRecommendations(
          connectionInfo[0]?.total_connections || 0, 
          parseInt(limitInfo[0]?.max_connections || '0')
        )
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        error: 'Failed to retrieve connection stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getRecommendations(currentConnections: number, maxConnections: number) {
    const usagePercentage = (currentConnections / maxConnections) * 100;
    
    if (usagePercentage > 80) {
      return {
        status: 'CRITICAL',
        message: 'Connection usage is very high. Consider increasing connection limit or optimizing queries.',
        action: 'Increase connection_limit parameter or optimize application queries'
      };
    } else if (usagePercentage > 60) {
      return {
        status: 'WARNING',
        message: 'Connection usage is moderate. Monitor closely.',
        action: 'Consider increasing connection_limit if usage continues to grow'
      };
    } else {
      return {
        status: 'HEALTHY',
        message: 'Connection usage is within normal range.',
        action: 'Continue monitoring'
      };
    }
  }
}
