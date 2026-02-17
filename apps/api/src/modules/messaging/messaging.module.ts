import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SupabaseService } from '../../services/supabase.service';
import { MessagingService } from './messaging.service';
import { MessagingWorker } from './messaging.worker';
import { MessagingOutboxRepository } from './messaging-outbox.repository';
import { SystemSettingsService } from './settings/system-settings.service';
import { TemplateResolverService } from './rendering/template-resolver.service';
import { PlaceholderRendererService } from './rendering/placeholder-renderer.service';
import { SmtpEmailService } from './providers/email-smtp.service';
import { AfricasTalkingSmsService } from './providers/sms-africas-talking.service';
import { MessagingAttachmentService } from './attachments/attachment.service';
import { AttachmentGeneratorService } from './attachments/attachment-generator.service';
import { MessagingTemplatesService } from './messaging-templates.service';
import { MessagingRoutesService } from './messaging-routes.service';
import { MessagingAttachmentTemplatesService } from './messaging-attachment-templates.service';
import { InternalMessagingController } from '../../controllers/internal/messaging.controller';
import { AfricasTalkingWebhookController } from '../../controllers/webhooks/messaging/africas-talking-webhook.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InternalMessagingController, AfricasTalkingWebhookController],
  providers: [
    SupabaseService,
    MessagingService,
    MessagingWorker,
    MessagingOutboxRepository,
    SystemSettingsService,
    MessagingTemplatesService,
    MessagingRoutesService,
    MessagingAttachmentTemplatesService,
    TemplateResolverService,
    PlaceholderRendererService,
    SmtpEmailService,
    AfricasTalkingSmsService,
    MessagingAttachmentService,
    AttachmentGeneratorService,
  ],
  exports: [MessagingService, SystemSettingsService],
})
export class MessagingModule {}

