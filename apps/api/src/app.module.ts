import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigurationModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiKeyAuthMiddleware } from './middleware/api-key-auth.middleware';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { ExternalIntegrationsService } from './services/external-integrations.service';
import { CustomerService } from './services/customer.service';
import { PartnerManagementService } from './services/partner-management.service';
import { CustomerController } from './controllers/customer.controller';
import { InternalPartnerManagementController } from './controllers/internal/partner-management.controller';
import { PublicPartnerManagementController } from './controllers/public/partner-management.controller';

@Module({
  imports: [ConfigurationModule, PrismaModule],
  controllers: [AppController, CustomerController, InternalPartnerManagementController, PublicPartnerManagementController],
  providers: [AppService, ExternalIntegrationsService, CustomerService, PartnerManagementService],
  exports: [PrismaModule], // Export PrismaModule so middleware can access PrismaService
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, ApiKeyAuthMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
