// Import this first!
import '../instrument';

// Now import other modules
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigurationService } from './config/configuration.service';
import { SwaggerConfig } from './config/swagger.config';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ExternalIntegrationsService } from './services/external-integrations.service';

async function bootstrap() {
  try {
    console.log('🚀 Starting MicroBima API...');
    console.log(`📦 Node version: ${process.version}`);
    console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV ?? 'not set'}`);
    console.log(`🔌 PORT: ${process.env.PORT ?? 'not set'}`);

    const app = await NestFactory.create(AppModule);
    console.log('✅ NestJS application created');

    // Get configuration service
    const configService = app.get(ConfigurationService);
    console.log('✅ Configuration service loaded');

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    console.log('✅ Global validation pipe configured');

    // Global exception filter - must be registered BEFORE built-in filters
    const externalIntegrationsService = app.get(ExternalIntegrationsService);
    app.useGlobalFilters(new GlobalExceptionFilter(externalIntegrationsService));
    console.log('✅ Global exception filter configured');

    // Set global prefix
    app.setGlobalPrefix(configService.apiPrefix);
    console.log(`✅ Global prefix set to: ${configService.apiPrefix}`);

    // CORS configuration - completely permissive for debugging
    app.enableCors({
      origin: '*',
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-correlation-id'],
    });
    console.log('✅ CORS enabled');

    // Setup Swagger documentation for both APIs
    SwaggerConfig.setupSwagger(app, configService);
    console.log('✅ Swagger documentation configured');

    const port = configService.port;
    console.log(`🔌 Attempting to listen on 0.0.0.0:${port}...`);

    // Listen on 0.0.0.0 for Fly.io compatibility (required for the proxy to reach the app)
    await app.listen(port, '0.0.0.0');

    console.log(`🚀 MicroBima API running on port ${port}`);
    console.log(`🌍 Environment: ${configService.environment}`);
    console.log(`🔧 API Prefix: ${configService.apiPrefix}`);
    console.log(`📊 Database Pool Size: ${configService.database.poolSize}`);
    console.log(`📚 Internal API docs: http://localhost:${port}/api/internal/docs`);
    console.log(`📚 Public API docs: http://localhost:${port}/api/v1/docs`);
    console.log(`✅ Application successfully started and listening on 0.0.0.0:${port}`);
  } catch (error) {
    console.error('❌ CRITICAL: Failed to start application');
    console.error('Error type:', error?.constructor?.name ?? 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    // Log additional context
    console.error('Environment variables:');
    console.error('  NODE_ENV:', process.env.NODE_ENV ?? 'not set');
    console.error('  PORT:', process.env.PORT ?? 'not set');
    console.error('  DATABASE_URL:', process.env.DATABASE_URL ? 'set (hidden)' : 'not set');
    console.error('  JWT_SECRET:', process.env.JWT_SECRET ? 'set (hidden)' : 'not set');

    // Exit with error code so Fly.io knows the deployment failed
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

bootstrap().catch((error) => {
  console.error('❌ Bootstrap function failed:', error);
  process.exit(1);
});
