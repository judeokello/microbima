/// <reference types="jest" />
import { PaymentFrequency } from '@prisma/client';
import { PolicyService } from '../policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { PaymentMessagingService } from '../../modules/messaging/payment-messaging.service';
import { PolicyLifecycleMessagingService } from '../../modules/messaging/policy-lifecycle-messaging.service';
import { ValidationException } from '../../exceptions/validation.exception';

describe('PolicyService - resolveExpectedInstallmentCount', () => {
  const prismaMock = {
    packagePaymentFrequency: {
      findUnique: jest.fn(),
    },
  };

  const policyService = new PolicyService(
    prismaMock as unknown as PrismaService,
    {} as unknown as PaymentAccountNumberService,
    {
      notifyMatchedPaymentSmsAsync: jest.fn(),
      tryEnqueueMatchedPaymentSms: jest.fn(),
    } as unknown as PaymentMessagingService,
    {
      suppressPendingActivationReminders: jest.fn(),
      enqueueLifecycleNotification: jest.fn(),
    } as unknown as PolicyLifecycleMessagingService,
    {
      onPolicyActivated: jest.fn(),
      onPolicyStatusChange: jest.fn(),
      onPolicyReplaced: jest.fn(),
    } as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns installment count for a supported package frequency', async () => {
    prismaMock.packagePaymentFrequency.findUnique.mockResolvedValue({
      installmentCount: 276,
    });

    await expect(
      policyService.resolveExpectedInstallmentCount(1, PaymentFrequency.DAILY)
    ).resolves.toBe(276);

    expect(prismaMock.packagePaymentFrequency.findUnique).toHaveBeenCalledWith({
      where: {
        packageId_frequency: { packageId: 1, frequency: PaymentFrequency.DAILY },
      },
      select: { installmentCount: true },
    });
  });

  it('rejects unsupported frequency for the package', async () => {
    prismaMock.packagePaymentFrequency.findUnique.mockResolvedValue(null);

    await expect(
      policyService.resolveExpectedInstallmentCount(1, PaymentFrequency.QUARTERLY)
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
