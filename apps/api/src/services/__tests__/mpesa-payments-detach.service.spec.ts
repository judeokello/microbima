/// <reference types="jest" />
import { MpesaPaymentsService } from '../mpesa-payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../supabase.service';
import { PolicyService } from '../policy.service';
import { PolicyLifecycleService } from '../policy-lifecycle.service';
import { PaymentMessagingService } from '../../modules/messaging/payment-messaging.service';
import { MessagingService } from '../../modules/messaging/messaging.service';
import { SystemSettingsService } from '../../modules/messaging/settings/system-settings.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { PaymentStatus, PolicyStatus } from '@prisma/client';

describe('MpesaPaymentsService - detach', () => {
  const prismaMock = {
    policy: { findFirst: jest.fn(), findMany: jest.fn() },
    mpesaPaymentReportItem: { findMany: jest.fn(), update: jest.fn() },
    policyPayment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const policyServiceMock = {
    activatePolicy: jest.fn(),
  };

  const policyLifecycleServiceMock = {
    applyPaymentToPolicyLifecycle: jest.fn(),
    recalculatePolicyLifecycleAfterPaidChange: jest.fn(),
  };

  const messagingServiceMock = {
    enqueue: jest.fn(),
  };

  const systemSettingsMock = {
    getSnapshot: jest.fn(),
  };

  let service: MpesaPaymentsService;

  const sourcePolicy = {
    id: 'policy-src',
    customerId: 'cust-src',
    status: PolicyStatus.ACTIVE,
    paymentAcNumber: '11111111',
    policyNumber: 'MP/SRC',
    customer: { idNumber: '11111111', firstName: 'Alice' },
  };

  const targetPolicy = {
    id: 'policy-tgt',
    customerId: 'cust-tgt',
    status: PolicyStatus.SUSPENDED,
    paymentAcNumber: '22222222',
    policyNumber: 'MP/TGT',
    customer: { idNumber: '22222222', firstName: 'Bob' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MpesaPaymentsService(
      prismaMock as unknown as PrismaService,
      {} as SupabaseService,
      policyServiceMock as unknown as PolicyService,
      { notifyMatchedPaymentSmsAsync: jest.fn() } as unknown as PaymentMessagingService,
      policyLifecycleServiceMock as unknown as PolicyLifecycleService,
      messagingServiceMock as unknown as MessagingService,
      systemSettingsMock as unknown as SystemSettingsService
    );

    systemSettingsMock.getSnapshot.mockResolvedValue({
      defaultSystemCurrency: 'Kes',
      general_support_number: '0700000000',
    });
    messagingServiceMock.enqueue.mockResolvedValue({
      createdDeliveryIds: ['d1'],
      correlationId: 'c',
    });
    policyLifecycleServiceMock.recalculatePolicyLifecycleAfterPaidChange.mockResolvedValue({
      action: 'suspended',
    });
    policyLifecycleServiceMock.applyPaymentToPolicyLifecycle.mockResolvedValue({
      action: 'restored_active',
    });
    policyServiceMock.activatePolicy.mockResolvedValue({ id: 'policy-tgt', status: 'ACTIVE' });

    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<void>) => fn(prismaMock)
    );
  });

  describe('listDetachablePayments', () => {
    it('returns non-detached completed payments', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(sourcePolicy);
      prismaMock.policyPayment.findMany.mockResolvedValue([
        {
          id: 10,
          transactionReference: 'TJBKX761Q8',
          amount: 500,
          expectedPaymentDate: new Date('2026-01-15T00:00:00.000Z'),
          actualPaymentDate: new Date('2026-01-15T10:00:00.000Z'),
          paymentStatus: PaymentStatus.COMPLETED,
          accountNumber: '11111111',
          details: null,
        },
      ]);

      const result = await service.listDetachablePayments('cust-src', 'policy-src', 'corr-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].transactionReference).toBe('TJBKX761Q8');
      expect(prismaMock.policyPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policyId: 'policy-src',
            detachedAt: null,
          }),
        })
      );
    });
  });

  describe('detachPaymentsFromPolicy', () => {
    const payment = {
      id: 42,
      policyId: 'policy-src',
      transactionReference: 'TJBKX761Q8',
      amount: 1500,
      expectedPaymentDate: new Date('2026-01-15T00:00:00.000Z'),
      actualPaymentDate: new Date('2026-01-15T10:00:00.000Z'),
      paymentStatus: PaymentStatus.COMPLETED,
      detachedAt: null,
      details: null,
    };

    it('soft-detaches, renames txRef, leaves unmapped when no rematch', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(sourcePolicy);
      prismaMock.policyPayment.findMany.mockResolvedValue([payment]);
      prismaMock.mpesaPaymentReportItem.findMany.mockResolvedValue([
        {
          id: 'ipn-1',
          transactionReference: 'TJBKX761Q8',
          paidIn: 1500,
          completionTime: new Date('2026-01-15T10:00:00.000Z'),
        },
      ]);
      prismaMock.policy.findMany.mockResolvedValue([]);
      prismaMock.policyPayment.update.mockResolvedValue({});
      prismaMock.mpesaPaymentReportItem.update.mockResolvedValue({});

      const result = await service.detachPaymentsFromPolicy(
        'cust-src',
        'policy-src',
        {
          paymentIds: [42],
          newAccountNumber: '99999999',
          reason: 'Wrong product',
          detachedBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
        'corr-detach'
      );

      expect(result.detachedCount).toBe(1);
      expect(result.detachedTotalAmount).toBe(1500);
      expect(result.rematchFound).toBe(false);
      expect(result.sourceLifecycleAction).toBe('suspended');
      expect(prismaMock.policyPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 42 },
          data: expect.objectContaining({
            paymentStatus: PaymentStatus.DETACHED,
            transactionReference: '[d]42-TJBKX761Q8',
            detachedBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          }),
        })
      );
      expect(prismaMock.mpesaPaymentReportItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountNumber: '99999999',
            isMapped: false,
            isProcessed: true,
          }),
        })
      );
      expect(messagingServiceMock.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ templateKey: 'payment_detached' })
      );
      expect(
        policyLifecycleServiceMock.recalculatePolicyLifecycleAfterPaidChange
      ).toHaveBeenCalledWith('policy-src', 'corr-detach');
    });

    it('rematches to target policy when account matches', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(sourcePolicy);
      prismaMock.policyPayment.findMany.mockResolvedValue([payment]);
      prismaMock.mpesaPaymentReportItem.findMany.mockResolvedValue([
        {
          id: 'ipn-1',
          transactionReference: 'TJBKX761Q8',
          paidIn: 1500,
          completionTime: new Date('2026-01-15T10:00:00.000Z'),
        },
      ]);
      prismaMock.policy.findMany.mockResolvedValue([targetPolicy]);
      prismaMock.policyPayment.findFirst.mockResolvedValue(null);
      prismaMock.policyPayment.update.mockResolvedValue({});
      prismaMock.policyPayment.create.mockResolvedValue({ id: 99 });
      prismaMock.mpesaPaymentReportItem.update.mockResolvedValue({});

      const result = await service.detachPaymentsFromPolicy(
        'cust-src',
        'policy-src',
        {
          paymentIds: [42],
          newAccountNumber: '22222222',
          reason: 'Belonged to other policy',
          detachedBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
        'corr-rematch'
      );

      expect(result.rematchFound).toBe(true);
      expect(result.rematchedCount).toBe(1);
      expect(result.targetPolicyNumber).toBe('MP/TGT');
      expect(result.targetLifecycleAction).toBe('restored_active');
      expect(prismaMock.policyPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            policyId: 'policy-tgt',
            transactionReference: 'TJBKX761Q8',
            paymentStatus: PaymentStatus.COMPLETED,
          }),
        })
      );
      expect(messagingServiceMock.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ templateKey: 'payment_detached' })
      );
      expect(messagingServiceMock.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ templateKey: 'payment_remapped' })
      );
    });

    it('rejects already detached payments', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(sourcePolicy);
      prismaMock.policyPayment.findMany.mockResolvedValue([
        { ...payment, detachedAt: new Date(), paymentStatus: PaymentStatus.DETACHED },
      ]);

      await expect(
        service.detachPaymentsFromPolicy(
          'cust-src',
          'policy-src',
          {
            paymentIds: [42],
            newAccountNumber: '99999999',
            reason: 'retry',
            detachedBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
          'corr-reject'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });
});
