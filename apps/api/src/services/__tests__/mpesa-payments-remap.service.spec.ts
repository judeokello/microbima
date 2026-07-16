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
import { PolicyStatus, MpesaPaymentSource } from '@prisma/client';

describe('MpesaPaymentsService - remap', () => {
  const prismaMock = {
    policy: { findFirst: jest.fn() },
    mpesaPaymentReportItem: { findMany: jest.fn(), update: jest.fn() },
    policyPayment: { findMany: jest.fn(), create: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const policyServiceMock = {
    activatePolicy: jest.fn(),
  };

  const policyLifecycleServiceMock = {
    applyPaymentToPolicyLifecycle: jest.fn(),
  };

  const messagingServiceMock = {
    enqueue: jest.fn(),
  };

  const systemSettingsMock = {
    getSnapshot: jest.fn(),
  };

  let service: MpesaPaymentsService;

  const basePolicy = {
    id: 'policy-1',
    customerId: 'cust-1',
    status: PolicyStatus.SUSPENDED,
    paymentAcNumber: '12345678',
    policyNumber: 'MP/001',
    customer: { idNumber: '12345678', firstName: 'Jane' },
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
    messagingServiceMock.enqueue.mockResolvedValue({ createdDeliveryIds: ['d1'], correlationId: 'c' });
    policyLifecycleServiceMock.applyPaymentToPolicyLifecycle.mockResolvedValue({
      action: 'restored_active',
    });
    policyServiceMock.activatePolicy.mockResolvedValue({ id: 'policy-1', status: 'ACTIVE' });

    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<void>) => {
      return fn(prismaMock);
    });
  });

  describe('listUnmappedMpesaPaymentsForRemap', () => {
    it('returns matching unmapped items', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(basePolicy);
      prismaMock.$queryRaw.mockResolvedValue([
        {
          id: 'item-1',
          transactionReference: 'TX1',
          paidIn: 500,
          completionTime: new Date('2026-01-15T10:00:00.000Z'),
          accountNumber: '9999',
          source: MpesaPaymentSource.IPN,
        },
      ]);

      const result = await service.listUnmappedMpesaPaymentsForRemap(
        'cust-1',
        'policy-1',
        '9999',
        'corr-1'
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].transactionReference).toBe('TX1');
      expect(result.items[0].paidIn).toBe(500);
    });

    it('rejects empty account number', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(basePolicy);
      await expect(
        service.listUnmappedMpesaPaymentsForRemap('cust-1', 'policy-1', '  ', 'corr-1')
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('remapMpesaPaymentsToPolicy', () => {
    const item = {
      id: '11111111-1111-4111-8111-111111111111',
      transactionReference: 'TX1',
      paidIn: 1500,
      completionTime: new Date('2026-01-15T10:00:00.000Z'),
      accountNumber: '9999',
      isProcessed: true,
      isMapped: false,
    };

    it('creates payments, updates items, runs lifecycle once, enqueues SMS', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(basePolicy);
      prismaMock.mpesaPaymentReportItem.findMany.mockResolvedValue([item]);
      prismaMock.policyPayment.findMany.mockResolvedValue([]);
      prismaMock.policyPayment.create.mockResolvedValue({ id: 1 });
      prismaMock.mpesaPaymentReportItem.update.mockResolvedValue({});

      const result = await service.remapMpesaPaymentsToPolicy(
        'cust-1',
        'policy-1',
        { accountNumber: '9999', itemIds: [item.id], reason: 'Wrong ID entered' },
        'corr-remap'
      );

      expect(result.mappedCount).toBe(1);
      expect(result.totalAmount).toBe(1500);
      expect(result.lifecycleAction).toBe('restored_active');
      expect(prismaMock.policyPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            policyId: 'policy-1',
            transactionReference: 'TX1',
            details: expect.stringContaining('Admin remap from 9999'),
            paymentSmsEnqueuedAt: expect.any(Date),
          }),
        })
      );
      expect(prismaMock.mpesaPaymentReportItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountNumber: '12345678',
            isMapped: true,
          }),
        })
      );
      expect(policyServiceMock.activatePolicy).not.toHaveBeenCalled();
      expect(policyLifecycleServiceMock.applyPaymentToPolicyLifecycle).toHaveBeenCalledTimes(1);
      expect(messagingServiceMock.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          templateKey: 'payment_remapped',
          placeholderValues: expect.objectContaining({
            amount: 'Kes 1,500',
            policy_number: 'MP/001',
          }),
        })
      );
    });

    it('rejects TERMINATED policies', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        ...basePolicy,
        status: PolicyStatus.TERMINATED,
      });

      await expect(
        service.remapMpesaPaymentsToPolicy(
          'cust-1',
          'policy-1',
          { accountNumber: '9999', itemIds: [item.id], reason: 'test' },
          'corr-term'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('allows DEACTIVATED and does not activate; lifecycle may noop', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        ...basePolicy,
        status: PolicyStatus.DEACTIVATED,
      });
      prismaMock.mpesaPaymentReportItem.findMany.mockResolvedValue([item]);
      prismaMock.policyPayment.findMany.mockResolvedValue([]);
      prismaMock.policyPayment.create.mockResolvedValue({ id: 1 });
      prismaMock.mpesaPaymentReportItem.update.mockResolvedValue({});
      policyLifecycleServiceMock.applyPaymentToPolicyLifecycle.mockResolvedValue({
        action: 'noop',
      });

      const result = await service.remapMpesaPaymentsToPolicy(
        'cust-1',
        'policy-1',
        { accountNumber: '9999', itemIds: [item.id], reason: 'remap to deactivated' },
        'corr-deact'
      );

      expect(result.mappedCount).toBe(1);
      expect(policyServiceMock.activatePolicy).not.toHaveBeenCalled();
      expect(policyLifecycleServiceMock.applyPaymentToPolicyLifecycle).toHaveBeenCalledTimes(1);
      expect(result.lifecycleAction).toBe('noop');
    });

    it('activates PENDING_ACTIVATION then still calls lifecycle', async () => {
      prismaMock.policy.findFirst.mockResolvedValue({
        ...basePolicy,
        status: PolicyStatus.PENDING_ACTIVATION,
      });
      prismaMock.mpesaPaymentReportItem.findMany.mockResolvedValue([item]);
      prismaMock.policyPayment.findMany.mockResolvedValue([]);
      prismaMock.policyPayment.create.mockResolvedValue({ id: 1 });
      prismaMock.mpesaPaymentReportItem.update.mockResolvedValue({});
      policyLifecycleServiceMock.applyPaymentToPolicyLifecycle.mockResolvedValue({
        action: 'noop',
      });

      const result = await service.remapMpesaPaymentsToPolicy(
        'cust-1',
        'policy-1',
        { accountNumber: '9999', itemIds: [item.id], reason: 'first payment' },
        'corr-pending'
      );

      expect(policyServiceMock.activatePolicy).toHaveBeenCalledWith('policy-1', 'corr-pending');
      expect(policyLifecycleServiceMock.applyPaymentToPolicyLifecycle).toHaveBeenCalledTimes(1);
      expect(result.lifecycleAction).toBe('activated');
    });

    it('sets admin note on insufficient_restore', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(basePolicy);
      prismaMock.mpesaPaymentReportItem.findMany.mockResolvedValue([item]);
      prismaMock.policyPayment.findMany.mockResolvedValue([]);
      prismaMock.policyPayment.create.mockResolvedValue({ id: 1 });
      prismaMock.mpesaPaymentReportItem.update.mockResolvedValue({});
      policyLifecycleServiceMock.applyPaymentToPolicyLifecycle.mockResolvedValue({
        action: 'insufficient_restore',
      });

      const result = await service.remapMpesaPaymentsToPolicy(
        'cust-1',
        'policy-1',
        { accountNumber: '9999', itemIds: [item.id], reason: 'partial' },
        'corr-insuff'
      );

      expect(result.note).toBe('Payments remapped; policy is still suspended');
      expect(result.lifecycleAction).toBe('insufficient_restore');
    });

    it('skips creating payment when transactionReference already exists but syncs flags', async () => {
      prismaMock.policy.findFirst.mockResolvedValue(basePolicy);
      prismaMock.mpesaPaymentReportItem.findMany.mockResolvedValue([item]);
      prismaMock.policyPayment.findMany.mockResolvedValue([{ transactionReference: 'TX1' }]);
      prismaMock.mpesaPaymentReportItem.update.mockResolvedValue({});

      const result = await service.remapMpesaPaymentsToPolicy(
        'cust-1',
        'policy-1',
        { accountNumber: '9999', itemIds: [item.id], reason: 'dup' },
        'corr-dup'
      );

      expect(result.mappedCount).toBe(0);
      expect(prismaMock.policyPayment.create).not.toHaveBeenCalled();
      expect(prismaMock.mpesaPaymentReportItem.update).toHaveBeenCalled();
      expect(messagingServiceMock.enqueue).not.toHaveBeenCalled();
      expect(policyLifecycleServiceMock.applyPaymentToPolicyLifecycle).not.toHaveBeenCalled();
    });
  });
});
