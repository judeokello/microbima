import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigurationService } from './config/configuration.service';
import { SwaggerConfig } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get configuration service
  const configService = app.get(ConfigurationService);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS configuration
  app.enableCors({
    origin: configService.cors.origin,
    credentials: configService.cors.credentials,
  });

  // Setup Swagger documentation for both APIs
  SwaggerConfig.setupSwagger(app, configService);

  const port = configService.port;
  await app.listen(port);
  
  console.log(`🚀 MicroBima API running on port ${port}`);
  console.log(`🌍 Environment: ${configService.environment}`);
  console.log(`🔧 API Prefix: ${configService.apiPrefix}`);
  console.log(`📊 Database Pool Size: ${configService.database.poolSize}`);
  console.log(`📚 Internal API docs: http://localhost:${port}/api/internal/docs`);
  console.log(`📚 Public API docs: http://localhost:${port}/api/v1/docs`);
}

bootstrap();
