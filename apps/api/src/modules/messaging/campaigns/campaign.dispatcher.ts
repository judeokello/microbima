import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupabaseService } from '../../../services/supabase.service';
import { SystemSettingsService } from '../settings/system-settings.service';
import { CampaignPreflightService } from './campaign-preflight.service';
import { applyNonProdMessagingPrefix, getNonProdMessagingTag } from '../non-prod-messaging.util';
import { tryToNationalPhoneNumber } from '../../../utils/phone-number.util';
import { AudienceMode, CampaignChannel, templateKeyForChannel } from './campaign.types';

@Injectable()
export class CampaignDispatcher {
  private readonly logger = new Logger(CampaignDispatcher.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    private readonly preflightService: CampaignPreflightService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Cron('*/15 * * * * *')
  async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      const due = await this.prisma.messagingCampaign.findMany({
        where: {
          status: 'DELAYED',
          dispatchStartsAt: { lte: new Date() },
        },
        orderBy: { dispatchStartsAt: 'asc' },
        take: 5,
      });
      for (const campaign of due) {
        await this.dispatchCampaign(campaign.id);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async dispatchCampaign(campaignId: string): Promise<void> {
    const claimed = await this.prisma.messagingCampaign.updateMany({
      where: { id: campaignId, status: 'DELAYED' },
      data: { status: 'DISPATCHING', dispatchStartedAt: new Date() },
    });
    if (claimed.count === 0) return;

    const campaign = await this.prisma.messagingCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;

    await this.prisma.messagingCampaignAuditEvent.create({
      data: {
        campaignId,
        eventType: 'DISPATCH_STARTED',
        actorUserId: null,
        payload: {} as Prisma.InputJsonValue,
      },
    });

    const settings = await this.systemSettings.getSnapshot();
    const snapshot = campaign.audienceSnapshot as {
      modes?: AudienceMode[];
      schemeIds?: number[];
      packageIds?: number[];
      customerStatuses?: string[];
      policyStatuses?: string[];
      pasteList?: string[];
    };

    const preflight = await this.preflightService.run({
      channel: campaign.channel as CampaignChannel,
      modes: snapshot.modes ?? [],
      schemeIds: snapshot.schemeIds ?? [],
      packageIds: snapshot.packageIds ?? [],
      customerStatuses: snapshot.customerStatuses ?? [],
      policyStatuses: snapshot.policyStatuses ?? [],
      pasteList: snapshot.pasteList,
      body: campaign.bodyWithPlaceholders,
      subject: campaign.subjectWithPlaceholders,
      supportNumbers: {
        general_support_number: settings.general_support_number,
        medical_support_number: settings.medical_support_number,
      },
    });

    const nodeEnv = process.env.NODE_ENV;
    const maxAttempts =
      campaign.channel === 'SMS' ? settings.smsMaxAttempts : settings.emailMaxAttempts;
    const templateKey = templateKeyForChannel(campaign.channel as CampaignChannel);

    let failureCount = 0;
    const nonProdTag = getNonProdMessagingTag(nodeEnv);

    for (const candidate of preflight.sendable) {
      try {
        let renderedBody = candidate.renderedBody;
        let renderedSubject = candidate.renderedSubject;
        let recipientPhone = campaign.channel === 'SMS' ? candidate.normalizedAddress : null;
        let recipientEmail = campaign.channel === 'EMAIL' ? candidate.normalizedAddress : null;

        if (candidate.customerId) {
          const customer = await this.prisma.customer.findUnique({
            where: { id: candidate.customerId },
            select: { phoneNumber: true, createdBy: true },
          });
          const prefixed = applyNonProdMessagingPrefix({
            nodeEnv,
            customerPhone: customer?.phoneNumber ?? null,
            channel: campaign.channel as 'SMS' | 'EMAIL',
            renderedBody,
            renderedSubject,
          });
          renderedBody = prefixed.renderedBody;
          renderedSubject = prefixed.renderedSubject;

          // FR-040: redirect customer-linked campaign sends to creator contacts in non-prod
          if (nonProdTag) {
            if (!customer?.createdBy) {
              this.logger.error(
                `Non-prod campaign: skip delivery; customer ${candidate.customerId} missing createdBy`,
              );
              failureCount += 1;
              continue;
            }
            const contacts = await this.supabaseService.getUserMessagingContacts(customer.createdBy);
            if (!contacts?.phone) {
              this.logger.error(
                `Non-prod campaign: skip delivery; creator ${customer.createdBy} has no phone`,
              );
              failureCount += 1;
              continue;
            }
            if (campaign.channel === 'SMS') {
              recipientPhone = contacts.phone;
            } else {
              if (!contacts.email) {
                this.logger.error(
                  `Non-prod campaign: skip EMAIL; creator ${customer.createdBy} has no email`,
                );
                failureCount += 1;
                continue;
              }
              recipientEmail = contacts.email;
            }
          }
        }

        await this.prisma.messagingDelivery.create({
          data: {
            templateKey,
            channel: campaign.channel,
            customerId: candidate.customerId,
            policyId: candidate.policyId,
            recipientPhone:
              campaign.channel === 'SMS' && recipientPhone
                ? (tryToNationalPhoneNumber(recipientPhone) ?? recipientPhone)
                : recipientPhone,
            recipientEmail,
            requestedLanguage: 'en',
            usedLanguage: 'en',
            renderedSubject,
            renderedBody,
            status: 'PENDING',
            maxAttempts,
            nextAttemptAt: new Date(),
            campaignId: campaign.id,
            correlationId: campaign.correlationId,
          },
        });
      } catch (err) {
        failureCount += 1;
        this.logger.error(
          `Failed to create delivery for campaign ${campaignId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const terminalStatus =
      failureCount > 0 || preflight.sendable.length === 0
        ? 'COMPLETED_WITH_FAILURES'
        : 'COMPLETED';

    // If still DISPATCHING (not cancelled mid-flight), finalize.
    await this.prisma.messagingCampaign.updateMany({
      where: { id: campaignId, status: 'DISPATCHING' },
      data: {
        status: terminalStatus,
        completedAt: new Date(),
        targetedCount: preflight.sendable.length,
      },
    });

    await this.prisma.messagingCampaignAuditEvent.create({
      data: {
        campaignId,
        eventType: 'DISPATCH_COMPLETED',
        actorUserId: null,
        payload: {
          status: terminalStatus,
          createdDeliveries: preflight.sendable.length - failureCount,
          failureCount,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
