import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';

export class SwaggerConfig {
  static setupSwagger(app: INestApplication, configService: ConfigurationService) {
    // Internal API Documentation
    this.setupInternalSwagger(app, configService);
    
    // Public API Documentation
    this.setupPublicSwagger(app, configService);
  }

  private static setupInternalSwagger(app: INestApplication, configService: ConfigurationService) {
    const internalConfig = new DocumentBuilder()
      .setTitle('MicroBima Internal API')
      .setDescription(`
        Internal API for MicroBima microinsurance platform.
        
        This API is intended for internal use, partner integrations, and administrative functions.
        
        **Authentication**: JWT Bearer Token required for all endpoints.
        **Rate Limiting**: ${configService.rateLimit.max} requests per ${configService.rateLimit.windowMs / 60000} minutes.
        **Environment**: ${configService.environment}
      `)
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth', // This name here is important for references
      )
      .addTag('Health', 'Health check and system status endpoints')
      .addTag('Configuration', 'Application configuration and environment information')
      .addTag('Customers', 'Customer management and onboarding operations')
      .addTag('Policies', 'Insurance policy management')
      .addTag('KYC', 'Know Your Customer verification processes')
      .addTag('Onboarding', 'Customer onboarding workflow management')
      .build();

    const internalDocument = SwaggerModule.createDocument(app, internalConfig, {
      include: [],
      ignoreGlobalPrefix: false,
      deepScanRoutes: true,
    });

    SwaggerModule.setup('api/internal/docs', app, internalDocument, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'MicroBima Internal API Documentation',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0 }
        .swagger-ui .scheme-container { margin: 20px 0 }
      `,
    });
  }

  private static setupPublicSwagger(app: INestApplication, configService: ConfigurationService) {
    const publicConfig = new DocumentBuilder()
      .setTitle('MicroBima Public API')
      .setDescription(`
        Public API for MicroBima microinsurance platform.
        
        This API is intended for customer applications, mobile apps, and third-party integrations.
        
        **Authentication**: OIDC/OAuth2 required for all endpoints.
        **Rate Limiting**: ${configService.rateLimit.max} requests per ${configService.rateLimit.windowMs / 60000} minutes.
        **Environment**: ${configService.environment}
        **CORS**: Enabled for specified origins
      `)
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: 'https://auth.microbima.com/oauth/authorize',
              tokenUrl: 'https://auth.microbima.com/oauth/token',
              scopes: {
                'read:customers': 'Read customer information',
                'write:customers': 'Create and update customer information',
                'read:policies': 'Read policy information',
                'write:policies': 'Create and update policies',
              },
            },
          },
        },
        'OAuth2-auth',
      )
      .addTag('Public Health', 'Public health check endpoints')
      .addTag('Customer Onboarding', 'Customer self-service onboarding')
      .addTag('Policy Management', 'Customer policy management')
      .addTag('KYC Verification', 'Customer identity verification')
      .addTag('Claims', 'Insurance claims processing')
      .addTag('Payments', 'Premium payments and billing')
      .addServer('https://api.microbima.com', 'Production Server')
      .addServer('https://staging-api.microbima.com', 'Staging Server')
      .addServer('http://localhost:3000', 'Local Development')
      .build();

    const publicDocument = SwaggerModule.createDocument(app, publicConfig, {
      include: [],
      ignoreGlobalPrefix: true,
      deepScanRoutes: true,
    });

    SwaggerModule.setup('api/v1/docs', app, publicDocument, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'MicroBima Public API Documentation',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0 }
        .swagger-ui .scheme-container { margin: 20px 0 }
        .swagger-ui .servers { margin: 20px 0 }
      `,
    });
  }
}
