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
import { INestApplication } from '@nestjs/common';

/**
 * Log all registered routes to verify route registration
 */
function logRegisteredRoutes(app: INestApplication, apiPrefix: string): void {
  try {
    const server = app.getHttpServer();
    const router = (server as { _router?: unknown; router?: unknown })._router ?? (server as { router?: unknown }).router;

    if (router && typeof router === 'object' && 'stack' in router && Array.isArray(router.stack)) {
      const routes: string[] = [];

      // Traverse the router stack to find all routes
      (router.stack as Array<{ route?: { methods: Record<string, boolean>; path: string }; name?: string; handle?: { stack?: unknown[] } }>).forEach((layer) => {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods)
            .filter(m => layer.route?.methods[m])
            .join(',')
            .toUpperCase();
          const path = layer.route.path;
          routes.push(`${methods} ${path}`);
        } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
          // Handle nested routers
          (layer.handle.stack as Array<{ route?: { methods: Record<string, boolean>; path: string } }>).forEach((nestedLayer) => {
            if (nestedLayer.route) {
              const methods = Object.keys(nestedLayer.route.methods)
                .filter(m => nestedLayer.route?.methods[m])
                .join(',')
                .toUpperCase();
              const path = nestedLayer.route.path;
              routes.push(`${methods} ${path}`);
            }
          });
        }
      });

      // Filter and log health-related routes
      const healthRoutes = routes.filter(r => r.toLowerCase().includes('health'));
      if (healthRoutes.length > 0) {
        console.log('🏥 Health Check Routes Found:');
        healthRoutes.forEach(route => console.log(`   ${route}`));
      } else {
        console.log('⚠️  No health check routes found in registered routes!');
      }

      // Log expected health route
      const expectedHealthRoute = `GET /${apiPrefix}/health`;
      console.log(`🔍 Expected health route: ${expectedHealthRoute}`);
      const found = routes.some(r => {
        const routeLower = r.toLowerCase();
        return routeLower.includes('health') && (routeLower.includes(apiPrefix) || routeLower.includes('/health'));
      });
      console.log(`✅ Health route found: ${found ? 'YES' : 'NO'}`);

      // Log all routes for debugging (first 20)
      if (routes.length > 0) {
        console.log(`📋 Total registered routes: ${routes.length}`);
        console.log('📋 Sample routes (first 10):');
        routes.slice(0, 10).forEach(route => console.log(`   ${route}`));
      }
    } else {
      console.log('⚠️  Could not access router stack to list routes');
    }
  } catch (error) {
    console.log('⚠️  Error listing routes:', error instanceof Error ? error.message : String(error));
  }
}

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

    // Set global prefix, but exclude health check routes and bootstrap routes
    // Bootstrap routes need to be accessible without the double prefix
    app.setGlobalPrefix(configService.apiPrefix, {
      exclude: [
        '/health',
        '/api/health',
        '/internal/health',
        '/api/internal/health',
        '/internal/bootstrap',
        '/internal/bootstrap/*'
      ]
    });
    console.log(`✅ Global prefix set to: ${configService.apiPrefix}`);
    console.log('✅ Health check routes excluded from global prefix');

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

    // Log registered routes to verify health check route is registered
    logRegisteredRoutes(app, configService.apiPrefix);

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
