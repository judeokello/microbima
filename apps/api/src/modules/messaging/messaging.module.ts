import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SupabaseService } from '../../services/supabase.service';
import { MessagingService } from './messaging.service';
import { MessagingWorker } from './messaging.worker';
import { PaymentMessagingService } from './payment-messaging.service';
import { PolicyLifecycleMessagingService } from './policy-lifecycle-messaging.service';
import { MessagingOutboxRepository } from './messaging-outbox.repository';
import { SystemSettingsService } from './settings/system-settings.service';
import { TemplateResolverService } from './rendering/template-resolver.service';
import { PlaceholderRendererService } from './rendering/placeholder-renderer.service';
import { SmtpEmailService } from './providers/email-smtp.service';
import { AfricasTalkingSmsService } from './providers/sms-africas-talking.service';
import { MessagingAttachmentService } from './attachments/attachment.service';
import { AttachmentRetentionCleanupService } from './attachments/attachment-retention-cleanup.service';
import { AttachmentGeneratorService } from './attachments/attachment-generator.service';
import { MessagingTemplatesService } from './messaging-templates.service';
import { MessagingRoutesService } from './messaging-routes.service';
import { MessagingAttachmentTemplatesService } from './messaging-attachment-templates.service';
import { AfricasTalkingWebhookService } from './africas-talking-webhook.service';
import { CampaignAudienceService } from './campaigns/campaign-audience.service';
import { CampaignPreflightService } from './campaigns/campaign-preflight.service';
import { CampaignService } from './campaigns/campaign.service';
import { CampaignDispatcher } from './campaigns/campaign.dispatcher';
import { InternalMessagingController } from '../../controllers/internal/messaging.controller';
import { MessagingCampaignsController } from '../../controllers/internal/messaging-campaigns.controller';
import { AfricasTalkingWebhookController } from '../../controllers/webhooks/messaging/africas-talking-webhook.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    InternalMessagingController,
    MessagingCampaignsController,
    AfricasTalkingWebhookController,
  ],
  providers: [
    SupabaseService,
    MessagingService,
    MessagingWorker,
    PaymentMessagingService,
    PolicyLifecycleMessagingService,
    MessagingOutboxRepository,
    SystemSettingsService,
    MessagingTemplatesService,
    MessagingRoutesService,
    MessagingAttachmentTemplatesService,
    AfricasTalkingWebhookService,
    TemplateResolverService,
    PlaceholderRendererService,
    SmtpEmailService,
    AfricasTalkingSmsService,
    MessagingAttachmentService,
    AttachmentGeneratorService,
    AttachmentRetentionCleanupService,
    CampaignAudienceService,
    CampaignPreflightService,
    CampaignService,
    CampaignDispatcher,
  ],
  exports: [
    MessagingService,
    SystemSettingsService,
    PaymentMessagingService,
    PolicyLifecycleMessagingService,
    SmtpEmailService,
    CampaignAudienceService,
    CampaignPreflightService,
    CampaignService,
  ],
})
export class MessagingModule {}

