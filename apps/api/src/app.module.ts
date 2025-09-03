import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigurationModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiKeyAuthMiddleware } from './middleware/api-key-auth.middleware';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { ExternalIntegrationsService } from './services/external-integrations.service';

@Module({
  imports: [ConfigurationModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService, ExternalIntegrationsService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, ApiKeyAuthMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
