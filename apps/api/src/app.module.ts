import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigurationModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiKeyAuthMiddleware } from './middleware/api-key-auth.middleware';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { SupabaseAuthMiddleware } from './middleware/supabase-auth.middleware';
import { MpesaCallbackLoggerMiddleware } from './middleware/mpesa-callback-logger.middleware';
import { ExternalIntegrationsService } from './services/external-integrations.service';
import { CustomerService } from './services/customer.service';
import { PartnerManagementService } from './services/partner-management.service';
import { SupabaseService } from './services/supabase.service';
import { SosService } from './services/sos.service';
import { AgentRegistrationService } from './services/agent-registration.service';
import { MissingRequirementService } from './services/missing-requirement.service';
import { ProductManagementService } from './services/product-management.service';
import { PolicyService } from './services/policy.service';
import { UnderwriterService } from './services/underwriter.service';
import { MpesaPaymentsService } from './services/mpesa-payments.service';
import { PaymentAccountNumberService } from './services/payment-account-number.service';
import { SchemeContactService } from './services/scheme-contact.service';
import { CustomerController } from './controllers/customer.controller';
import { InternalCustomerController } from './controllers/internal/customer.controller';
import { InternalPartnerManagementController } from './controllers/internal/partner-management.controller';
import { PublicPartnerManagementController } from './controllers/public/partner-management.controller';
import { SupabaseTestController } from './controllers/internal/supabase-test.controller';
import { ConnectionMonitorController } from './controllers/internal/connection-monitor.controller';
import { SosController } from './controllers/sos.controller';
import { AgentRegistrationController } from './controllers/internal/agent-registration.controller';
import { BootstrapController } from './controllers/internal/bootstrap.controller';
import { ProductManagementController } from './controllers/internal/product-management.controller';
import { PolicyController } from './controllers/internal/policy.controller';
import { UnderwriterController } from './controllers/internal/underwriter.controller';
import { UserController } from './controllers/internal/user.controller';
import { MpesaPaymentsController } from './controllers/internal/mpesa-payments.controller';
import { MpesaIpnController } from './controllers/public/mpesa-ipn.controller';
import { MpesaStkPushController } from './controllers/internal/mpesa-stk-push.controller';
import { MpesaStkPushPublicController } from './controllers/public/mpesa-stk-push.controller';
import { RecoveryController } from './controllers/internal/recovery.controller';
import { TestCustomersController } from './controllers/internal/test-customers.controller';
import { MpesaIpnService } from './services/mpesa-ipn.service';
import { MpesaStkPushService } from './services/mpesa-stk-push.service';
import { MpesaDarajaApiService } from './services/mpesa-daraja-api.service';
import { MpesaErrorMapperService } from './services/mpesa-error-mapper.service';
import { TestCustomersService } from './services/test-customers.service';
import { IpWhitelistGuard } from './guards/ip-whitelist.guard';
import { MessagingModule } from './modules/messaging/messaging.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigurationModule,
    PrismaModule,
    MessagingModule,
  ],
  controllers: [AppController, CustomerController, InternalCustomerController, InternalPartnerManagementController, PublicPartnerManagementController, SupabaseTestController, ConnectionMonitorController, SosController, AgentRegistrationController, BootstrapController, ProductManagementController, PolicyController, UnderwriterController, UserController, MpesaPaymentsController, MpesaIpnController, MpesaStkPushController, MpesaStkPushPublicController, RecoveryController, TestCustomersController],
  providers: [AppService, ExternalIntegrationsService, CustomerService, PartnerManagementService, SupabaseService, SosService, AgentRegistrationService, MissingRequirementService, ProductManagementService, PolicyService, UnderwriterService, MpesaPaymentsService, PaymentAccountNumberService, SchemeContactService, MpesaIpnService, MpesaStkPushService, MpesaDarajaApiService, MpesaErrorMapperService, TestCustomersService, IpWhitelistGuard],
  exports: [PrismaModule], // Export PrismaModule so middleware can access PrismaService
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Log M-Pesa callbacks first (before other middleware)
    consumer
      .apply(MpesaCallbackLoggerMiddleware)
      .forRoutes({ path: 'public/mpesa/*', method: RequestMethod.ALL });

    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*'); // Apply correlation ID to all routes

    consumer
      .apply(ApiKeyAuthMiddleware)
      .forRoutes('*'); // Apply API key auth to all routes

    consumer
      .apply(SupabaseAuthMiddleware)
      .forRoutes({ path: 'internal/*', method: RequestMethod.ALL }); // Apply Supabase auth to internal routes only
  }
}
