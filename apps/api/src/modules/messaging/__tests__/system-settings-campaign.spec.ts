import { SystemSettingsService } from '../settings/system-settings.service';

describe('SystemSettingsService campaign keys', () => {
  it('coerces campaign settings from JSON via assignFromJson + getSnapshot path', async () => {
    const prisma = {
      systemSettingsMeta: {
        upsert: jest.fn().mockResolvedValue({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
        update: jest.fn(),
      },
      systemSetting: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'campaignConfirmThreshold', value: '25' },
          { key: 'campaignSmsDelaySeconds', value: 90 },
          { key: 'campaignEmailDelaySeconds', value: '240' },
          { key: 'campaignIdempotencyWindowMinutes', value: 15 },
        ]),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const service = new SystemSettingsService(prisma as any);
    const snap = await service.getSnapshot();

    expect(snap.campaignConfirmThreshold).toBe(25);
    expect(snap.campaignSmsDelaySeconds).toBe(90);
    expect(snap.campaignEmailDelaySeconds).toBe(240);
    expect(snap.campaignIdempotencyWindowMinutes).toBe(15);
  });

  it('falls back to defaults when campaign keys are missing', async () => {
    const prisma = {
      systemSettingsMeta: {
        upsert: jest.fn().mockResolvedValue({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
        update: jest.fn(),
      },
      systemSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const service = new SystemSettingsService(prisma as any);
    const snap = await service.getSnapshot();

    expect(snap.campaignConfirmThreshold).toBe(20);
    expect(snap.campaignSmsDelaySeconds).toBe(120);
    expect(snap.campaignEmailDelaySeconds).toBe(180);
    expect(snap.campaignIdempotencyWindowMinutes).toBe(10);
  });
});
