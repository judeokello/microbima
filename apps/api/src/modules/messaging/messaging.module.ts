import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SupabaseService } from '../../services/supabase.service';
import { MessagingService } from './messaging.service';
import { MessagingWorker } from './messaging.worker';
import { MessagingOutboxRepository } from './messaging-outbox.repository';
import { SystemSettingsService } from './settings/system-settings.service';
import { TemplateResolverService } from './rendering/template-resolver.service';
import { PlaceholderRendererService } from './rendering/placeholder-renderer.service';
import { SendGridEmailService } from './providers/email-sendgrid.service';
import { AfricasTalkingSmsService } from './providers/sms-africas-talking.service';
import { MessagingAttachmentService } from './attachments/attachment.service';
import { MessagingTemplatesService } from './messaging-templates.service';
import { MessagingRoutesService } from './messaging-routes.service';
import { InternalMessagingController } from '../../controllers/internal/messaging.controller';
import { SendGridWebhookController } from '../../controllers/webhooks/messaging/sendgrid-webhook.controller';
import { AfricasTalkingWebhookController } from '../../controllers/webhooks/messaging/africas-talking-webhook.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InternalMessagingController, SendGridWebhookController, AfricasTalkingWebhookController],
  providers: [
    SupabaseService,
    MessagingService,
    MessagingWorker,
    MessagingOutboxRepository,
    SystemSettingsService,
    MessagingTemplatesService,
    MessagingRoutesService,
    TemplateResolverService,
    PlaceholderRendererService,
    SendGridEmailService,
    AfricasTalkingSmsService,
    MessagingAttachmentService,
  ],
  exports: [MessagingService, SystemSettingsService],
})
export class MessagingModule {}

