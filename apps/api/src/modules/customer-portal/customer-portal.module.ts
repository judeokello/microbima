import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { SupabaseService } from '../../services/supabase.service';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';
import { SupabaseCustomerGuard } from './guards/supabase-customer.guard';

@Module({
  imports: [MessagingModule],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService, SupabaseCustomerGuard, SupabaseService],
})
export class CustomerPortalModule {}
