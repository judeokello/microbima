import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { ConfigurationService } from './config/configuration.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigurationService,
  ) {}

  @Get('health')
  @ApiOperation({ 
    summary: 'Root Health Check',
    description: 'Basic health check endpoint accessible without authentication'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Application is healthy',
    schema: {
      type: 'string',
      example: 'MicroBima API is running!'
    }
  })
  getHealth(): string {
    return this.appService.getHealth();
  }

  @Get('api/internal/health')
  @ApiTags('Health')
  @ApiOperation({ 
    summary: 'Internal Health Check',
    description: 'Health check for internal API endpoints'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Internal API is healthy',
    schema: {
      type: 'string',
      example: 'MicroBima Internal API is running!'
    }
  })
  getInternalHealth(): string {
    return this.appService.getInternalHealth();
  }

  @Get('api/v1/health')
  @ApiTags('Public Health')
  @ApiOperation({ 
    summary: 'Public Health Check',
    description: 'Health check for public API endpoints'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Public API is healthy',
    schema: {
      type: 'string',
      example: 'MicroBima Public API is running!'
    }
  })
  getPublicHealth(): string {
    return this.appService.getPublicHealth();
  }

  @Get('api/internal/config/health')
  @ApiTags('Configuration')
  @ApiOperation({ 
    summary: 'Configuration Health Check',
    description: 'Get current application configuration and environment information'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Configuration information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        environment: { type: 'string', example: 'development' },
        port: { type: 'number', example: 3000 },
        apiPrefix: { type: 'string', example: 'api' },
        database: {
          type: 'object',
          properties: {
            poolSize: { type: 'number', example: 5 },
            ssl: { type: 'boolean', example: false },
            timeout: { type: 'number', example: 10000 }
          }
        },
        jwt: {
          type: 'object',
          properties: {
            expiresIn: { type: 'string', example: '24h' }
          }
        },
        cors: {
          type: 'object',
          properties: {
            origin: { type: 'array', items: { type: 'string' }, example: ['http://localhost:3000'] },
            credentials: { type: 'boolean', example: true }
          }
        },
        rateLimit: {
          type: 'object',
          properties: {
            windowMs: { type: 'number', example: 900000 },
            max: { type: 'number', example: 100 }
          }
        },
        logging: {
          type: 'object',
          properties: {
            level: { type: 'string', example: 'debug' },
            enableConsole: { type: 'boolean', example: true },
            enableFile: { type: 'boolean', example: false }
          }
        }
      }
    }
  })
  getConfigHealth() {
    return {
      environment: this.configService.environment,
      port: this.configService.port,
      apiPrefix: this.configService.apiPrefix,
      database: {
        poolSize: this.configService.database.poolSize,
        ssl: this.configService.database.ssl,
        timeout: this.configService.database.timeout,
      },
      jwt: {
        expiresIn: this.configService.jwt.expiresIn,
      },
      cors: {
        origin: this.configService.cors.origin,
        credentials: this.configService.cors.credentials,
      },
      rateLimit: {
        windowMs: this.configService.rateLimit.windowMs,
        max: this.configService.rateLimit.max,
      },
      logging: {
        level: this.configService.logging.level,
        enableConsole: this.configService.logging.enableConsole,
        enableFile: this.configService.logging.enableFile,
      },
    };
  }
}
