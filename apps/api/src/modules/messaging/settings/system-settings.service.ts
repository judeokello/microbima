import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MessagingSettingsSnapshot } from '../messaging.types';
import { Prisma } from '@prisma/client';

type SettingKey = keyof MessagingSettingsSnapshot;

const DEFAULT_SETTINGS: MessagingSettingsSnapshot = {
  defaultMessagingLanguage: 'en',
  smsMaxAttempts: 2,
  emailMaxAttempts: 5,
  baseRetryDelaySeconds: 30,
  maxRetryDelaySeconds: 3600,
  workerPollIntervalSeconds: 5,
  workerBatchSize: 50,
  workerMaxConcurrency: 10,
  systemSettingsCacheRefreshSeconds: 30,
  messagingAttachmentRetentionMonths: 3,
  messagingContentRetentionMonths: 84,
};

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a snapshot of messaging settings.
   *
   * NOTE: Implemented in T007/T045 with DB-backed cache + meta.updatedAt refresh.
   */
  private cache: MessagingSettingsSnapshot | null = null;
  private lastMetaUpdatedAt: Date | null = null;
  private lastMetaCheckAtMs = 0;

  async getSnapshot(): Promise<MessagingSettingsSnapshot> {
    await this.ensureSeedDefaults();

    const now = Date.now();
    const refreshSeconds = this.cache?.systemSettingsCacheRefreshSeconds ?? DEFAULT_SETTINGS.systemSettingsCacheRefreshSeconds;
    const refreshIntervalMs = Math.max(1, refreshSeconds) * 1000;

    if (this.cache && now - this.lastMetaCheckAtMs < refreshIntervalMs) {
      return this.cache;
    }

    const meta = await this.prisma.systemSettingsMeta.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
      select: { updatedAt: true },
    });

    this.lastMetaCheckAtMs = now;

    if (this.cache && this.lastMetaUpdatedAt && meta.updatedAt.getTime() === this.lastMetaUpdatedAt.getTime()) {
      return this.cache;
    }

    const rows = await this.prisma.systemSetting.findMany({
      select: { key: true, value: true },
    });

    const next: MessagingSettingsSnapshot = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      const key = row.key as SettingKey;
      if (!(key in next)) continue;

      const val = row.value as unknown;
      this.assignFromJson(next, key, val);
    }

    // Coerce numeric fields defensively.
    next.smsMaxAttempts = this.coerceInt(next.smsMaxAttempts, DEFAULT_SETTINGS.smsMaxAttempts);
    next.emailMaxAttempts = this.coerceInt(next.emailMaxAttempts, DEFAULT_SETTINGS.emailMaxAttempts);
    next.baseRetryDelaySeconds = this.coerceInt(next.baseRetryDelaySeconds, DEFAULT_SETTINGS.baseRetryDelaySeconds);
    next.maxRetryDelaySeconds = this.coerceInt(next.maxRetryDelaySeconds, DEFAULT_SETTINGS.maxRetryDelaySeconds);
    next.workerPollIntervalSeconds = this.coerceInt(next.workerPollIntervalSeconds, DEFAULT_SETTINGS.workerPollIntervalSeconds);
    next.workerBatchSize = this.coerceInt(next.workerBatchSize, DEFAULT_SETTINGS.workerBatchSize);
    next.workerMaxConcurrency = this.coerceInt(next.workerMaxConcurrency, DEFAULT_SETTINGS.workerMaxConcurrency);
    next.systemSettingsCacheRefreshSeconds = this.coerceInt(
      next.systemSettingsCacheRefreshSeconds,
      DEFAULT_SETTINGS.systemSettingsCacheRefreshSeconds,
    );
    next.messagingAttachmentRetentionMonths = this.coerceInt(
      next.messagingAttachmentRetentionMonths,
      DEFAULT_SETTINGS.messagingAttachmentRetentionMonths,
    );
    next.messagingContentRetentionMonths = this.coerceInt(
      next.messagingContentRetentionMonths,
      DEFAULT_SETTINGS.messagingContentRetentionMonths,
    );

    this.cache = next;
    this.lastMetaUpdatedAt = meta.updatedAt;
    this.logger.debug(`Settings cache refreshed (metaUpdatedAt=${meta.updatedAt.toISOString()})`);
    return next;
  }

  async updateSettings(partial: Partial<MessagingSettingsSnapshot>, updatedBy?: string) {
    await this.ensureSeedDefaults();

    const entries = Object.entries(partial) as Array<[SettingKey, unknown]>;
    await this.prisma.$transaction(async (tx) => {
      for (const [key, value] of entries) {
        if (!(key in DEFAULT_SETTINGS)) continue;
        await tx.systemSetting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue, updatedBy: updatedBy ?? null },
          update: { value: value as Prisma.InputJsonValue, updatedBy: updatedBy ?? null },
        });
      }
      // Touch meta marker so other instances refresh within SLA.
      await tx.systemSettingsMeta.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      });
    });

    // Clear local cache so next read reloads.
    this.cache = null;
    this.lastMetaUpdatedAt = null;
    this.lastMetaCheckAtMs = 0;
  }

  async listSettings() {
    await this.ensureSeedDefaults();
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  private async ensureSeedDefaults() {
    // Ensure meta exists
    await this.prisma.systemSettingsMeta.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });

    // Seed missing settings keys (idempotent)
    const existing = await this.prisma.systemSetting.findMany({
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((r) => r.key));

    const creates = Object.entries(DEFAULT_SETTINGS)
      .filter(([k]) => !existingKeys.has(k))
      .map(([key, value]) =>
        this.prisma.systemSetting.create({
          data: { key, value: value as Prisma.InputJsonValue },
        }),
      );

    if (creates.length > 0) {
      await this.prisma.$transaction(creates);
      // Touch meta so other instances see seeded defaults.
      await this.prisma.systemSettingsMeta.update({
        where: { id: 1 },
        data: {},
      });
    }
  }

  private coerceInt(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return Math.trunc(n);
    }
    return fallback;
  }

  private assignFromJson(target: MessagingSettingsSnapshot, key: SettingKey, val: unknown) {
    switch (key) {
      case 'defaultMessagingLanguage':
        if (typeof val === 'string' && val.trim() !== '') target.defaultMessagingLanguage = val;
        return;
      case 'smsMaxAttempts':
        target.smsMaxAttempts = this.coerceInt(val, DEFAULT_SETTINGS.smsMaxAttempts);
        return;
      case 'emailMaxAttempts':
        target.emailMaxAttempts = this.coerceInt(val, DEFAULT_SETTINGS.emailMaxAttempts);
        return;
      case 'baseRetryDelaySeconds':
        target.baseRetryDelaySeconds = this.coerceInt(val, DEFAULT_SETTINGS.baseRetryDelaySeconds);
        return;
      case 'maxRetryDelaySeconds':
        target.maxRetryDelaySeconds = this.coerceInt(val, DEFAULT_SETTINGS.maxRetryDelaySeconds);
        return;
      case 'workerPollIntervalSeconds':
        target.workerPollIntervalSeconds = this.coerceInt(val, DEFAULT_SETTINGS.workerPollIntervalSeconds);
        return;
      case 'workerBatchSize':
        target.workerBatchSize = this.coerceInt(val, DEFAULT_SETTINGS.workerBatchSize);
        return;
      case 'workerMaxConcurrency':
        target.workerMaxConcurrency = this.coerceInt(val, DEFAULT_SETTINGS.workerMaxConcurrency);
        return;
      case 'systemSettingsCacheRefreshSeconds':
        target.systemSettingsCacheRefreshSeconds = this.coerceInt(val, DEFAULT_SETTINGS.systemSettingsCacheRefreshSeconds);
        return;
      case 'messagingAttachmentRetentionMonths':
        target.messagingAttachmentRetentionMonths = this.coerceInt(val, DEFAULT_SETTINGS.messagingAttachmentRetentionMonths);
        return;
      case 'messagingContentRetentionMonths':
        target.messagingContentRetentionMonths = this.coerceInt(val, DEFAULT_SETTINGS.messagingContentRetentionMonths);
        return;
    }
  }
}

