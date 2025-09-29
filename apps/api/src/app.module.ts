import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigurationModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiKeyAuthMiddleware } from './middleware/api-key-auth.middleware';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { ExternalIntegrationsService } from './services/external-integrations.service';
import { CustomerService } from './services/customer.service';
import { PartnerManagementService } from './services/partner-management.service';
import { SupabaseService } from './services/supabase.service';
import { SosService } from './services/sos.service';
import { CustomerController } from './controllers/customer.controller';
import { InternalCustomerController } from './controllers/internal/customer.controller';
import { InternalPartnerManagementController } from './controllers/internal/partner-management.controller';
import { PublicPartnerManagementController } from './controllers/public/partner-management.controller';
import { SupabaseTestController } from './controllers/internal/supabase-test.controller';
import { ConnectionMonitorController } from './controllers/internal/connection-monitor.controller';
import { SosController } from './controllers/sos.controller';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigurationModule,
    PrismaModule
  ],
  controllers: [AppController, CustomerController, InternalCustomerController, InternalPartnerManagementController, PublicPartnerManagementController, SupabaseTestController, ConnectionMonitorController, SosController],
  providers: [AppService, ExternalIntegrationsService, CustomerService, PartnerManagementService, SupabaseService, SosService],
  exports: [PrismaModule], // Export PrismaModule so middleware can access PrismaService
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*'); // Apply correlation ID to all routes

    consumer
      .apply(ApiKeyAuthMiddleware)
      .forRoutes('*'); // Apply API key auth to all routes
  }
}
