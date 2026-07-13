/// <reference types="jest" />
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PolicyService } from '../policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { PaymentMessagingService } from '../../modules/messaging/payment-messaging.service';
import { PolicyLifecycleMessagingService } from '../../modules/messaging/policy-lifecycle-messaging.service';
import { Prisma } from '@prisma/client';

describe('PolicyService - generatePolicyNumber', () => {
  const prismaMock = {
    package: {
      findUnique: jest.fn(),
    },
    policy: {
      findFirst: jest.fn(),
    },
  };

  const paymentAccountNumberServiceMock = {
    generateForPolicy: jest.fn(),
    generateForScheme: jest.fn(),
    customerHasExistingPolicies: jest.fn(),
  };

  const paymentMessagingServiceMock = {
    notifyMatchedPaymentSmsAsync: jest.fn(),
    tryEnqueueMatchedPaymentSms: jest.fn(),
  };

  const lifecycleMessagingServiceMock = {
    suppressPendingActivationReminders: jest.fn(),
    enqueueLifecycleNotification: jest.fn(),
  };

  const policyService = new PolicyService(
    prismaMock as unknown as PrismaService,
    paymentAccountNumberServiceMock as unknown as PaymentAccountNumberService,
    paymentMessagingServiceMock as unknown as PaymentMessagingService,
    lifecycleMessagingServiceMock as unknown as PolicyLifecycleMessagingService
  );

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.package.findUnique.mockResolvedValue({
      id: 1,
      policyNumberFormat: 'MP/MFG/{auto-increasing-policy-number}',
    });
  });

  it('should increment policy number sequences extracted from the format placeholder', async () => {
    prismaMock.policy.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ policyNumber: 'MP/MFG/001' });

    const firstPolicyNumber = await (
      policyService as unknown as {
        generatePolicyNumber: (packageId: number, correlationId: string) => Promise<string>;
      }
    ).generatePolicyNumber(1, 'corr-1');
    const secondPolicyNumber = await (
      policyService as unknown as {
        generatePolicyNumber: (packageId: number, correlationId: string) => Promise<string>;
      }
    ).generatePolicyNumber(1, 'corr-2');

    expect(firstPolicyNumber).toBe('MP/MFG/001');
    expect(secondPolicyNumber).toBe('MP/MFG/002');
  });
});

describe('PolicyService - mapUnmappedMpesaItemsToPolicy', () => {
  const txMock = {
    $queryRaw: jest.fn(),
    policyPayment: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    policy: {
      findUnique: jest.fn(),
    },
    mpesaPaymentReportItem: {
      update: jest.fn(),
    },
  };

  const prismaMock = {};
  const paymentAccountNumberServiceMock = {};
  const paymentMessagingServiceMock = {
    notifyMatchedPaymentSmsAsync: jest.fn(),
  };
  const lifecycleMessagingServiceMock = {
    suppressPendingActivationReminders: jest.fn(),
  };

  let policyService: PolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    policyService = new PolicyService(
      prismaMock as unknown as PrismaService,
      paymentAccountNumberServiceMock as unknown as PaymentAccountNumberService,
      paymentMessagingServiceMock as unknown as PaymentMessagingService,
      lifecycleMessagingServiceMock as unknown as PolicyLifecycleMessagingService
    );
    jest.spyOn(policyService, 'activatePolicy').mockResolvedValue({
      id: 'policy-1',
      status: 'ACTIVE',
    } as never);
  });

  it('returns zeros when paymentAcNumber is empty', async () => {
    const result = await policyService.mapUnmappedMpesaItemsToPolicy(
      'policy-1',
      '   ',
      'corr-empty',
      txMock as unknown as Prisma.TransactionClient
    );

    expect(result).toEqual({ mappedCount: 0, activated: false, policyPaymentIds: [] });
    expect(txMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns zeros when no matching report items exist', async () => {
    txMock.$queryRaw.mockResolvedValue([]);

    const result = await policyService.mapUnmappedMpesaItemsToPolicy(
      'policy-1',
      '12345678',
      'corr-none',
      txMock as unknown as Prisma.TransactionClient
    );

    expect(result).toEqual({ mappedCount: 0, activated: false, policyPaymentIds: [] });
    expect(txMock.policyPayment.create).not.toHaveBeenCalled();
  });

  it('creates policy_payments for unmapped items, marks mapped, and activates pending policy', async () => {
    txMock.$queryRaw.mockResolvedValue([
      {
        id: 'item-1',
        transactionReference: 'ABC123',
        paidIn: 100,
        completionTime: new Date('2026-01-10T10:00:00.000Z'),
        accountNumber: '12345678',
        isMapped: false,
        isProcessed: false,
      },
      {
        id: 'item-dup',
        transactionReference: 'ABC123',
        paidIn: 100,
        completionTime: new Date('2026-01-10T11:00:00.000Z'),
        accountNumber: '12345678',
        isMapped: false,
        isProcessed: false,
      },
    ]);
    txMock.policyPayment.findMany.mockResolvedValue([]);
    txMock.policy.findUnique.mockResolvedValue({ id: 'policy-1', status: 'PENDING_ACTIVATION' });
    txMock.policyPayment.create.mockResolvedValue({ id: 42 });
    txMock.mpesaPaymentReportItem.update.mockResolvedValue({});

    const result = await policyService.mapUnmappedMpesaItemsToPolicy(
      'policy-1',
      '12345678',
      'corr-map',
      txMock as unknown as Prisma.TransactionClient,
      { activateIfPending: true }
    );

    expect(txMock.policyPayment.create).toHaveBeenCalledTimes(1);
    expect(txMock.policyPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        policyId: 'policy-1',
        paymentType: 'MPESA',
        transactionReference: 'ABC123',
        amount: 100,
        paymentStatus: 'COMPLETED',
      }),
    });
    expect(txMock.mpesaPaymentReportItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { isProcessed: true, isMapped: true },
    });
    expect(policyService.activatePolicy).toHaveBeenCalledWith(
      'policy-1',
      'corr-map',
      txMock
    );
    expect(result).toEqual({
      mappedCount: 1,
      activated: true,
      policyPaymentIds: [42],
    });
  });

  it('skips refs that already exist in policy_payments and syncs isMapped flags', async () => {
    txMock.$queryRaw.mockResolvedValue([
      {
        id: 'item-1',
        transactionReference: 'EXISTING',
        paidIn: 50,
        completionTime: new Date('2026-01-01T00:00:00.000Z'),
        accountNumber: '12345678',
        isMapped: false,
        isProcessed: false,
      },
    ]);
    txMock.policyPayment.findMany.mockResolvedValue([{ transactionReference: 'EXISTING' }]);
    txMock.policy.findUnique.mockResolvedValue({ id: 'policy-1', status: 'ACTIVE' });
    txMock.mpesaPaymentReportItem.update.mockResolvedValue({});

    const result = await policyService.mapUnmappedMpesaItemsToPolicy(
      'policy-1',
      '12345678',
      'corr-skip',
      txMock as unknown as Prisma.TransactionClient
    );

    expect(txMock.policyPayment.create).not.toHaveBeenCalled();
    expect(txMock.mpesaPaymentReportItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { isProcessed: true, isMapped: true },
    });
    expect(policyService.activatePolicy).not.toHaveBeenCalled();
    expect(result).toEqual({ mappedCount: 0, activated: false, policyPaymentIds: [] });
  });

  it('does not activate when activateIfPending is false', async () => {
    txMock.$queryRaw.mockResolvedValue([
      {
        id: 'item-1',
        transactionReference: 'NEWREF',
        paidIn: 75,
        completionTime: new Date('2026-02-01T00:00:00.000Z'),
        accountNumber: '12345678',
        isMapped: false,
        isProcessed: false,
      },
    ]);
    txMock.policyPayment.findMany.mockResolvedValue([]);
    txMock.policy.findUnique.mockResolvedValue({ id: 'policy-1', status: 'PENDING_ACTIVATION' });
    txMock.policyPayment.create.mockResolvedValue({ id: 7 });
    txMock.mpesaPaymentReportItem.update.mockResolvedValue({});

    const result = await policyService.mapUnmappedMpesaItemsToPolicy(
      'policy-1',
      '12345678',
      'corr-no-act',
      txMock as unknown as Prisma.TransactionClient,
      { activateIfPending: false }
    );

    expect(result.mappedCount).toBe(1);
    expect(result.activated).toBe(false);
    expect(policyService.activatePolicy).not.toHaveBeenCalled();
  });
});

describe('PolicyService - assertRecoveryAccessToCustomer', () => {
  const prismaMock = {
    customer: {
      findUnique: jest.fn(),
    },
  };

  const policyService = new PolicyService(
    prismaMock as unknown as PrismaService,
    {} as PaymentAccountNumberService,
    {} as PaymentMessagingService,
    {} as PolicyLifecycleMessagingService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows registration_admin for any customer', async () => {
    await expect(
      policyService.assertRecoveryAccessToCustomer(
        'cust-1',
        'user-other',
        ['registration_admin'],
        'corr-admin'
      )
    ).resolves.toBeUndefined();
    expect(prismaMock.customer.findUnique).not.toHaveBeenCalled();
  });

  it('allows the registering agent', async () => {
    prismaMock.customer.findUnique.mockResolvedValue({
      id: 'cust-1',
      createdBy: 'agent-1',
    });

    await expect(
      policyService.assertRecoveryAccessToCustomer(
        'cust-1',
        'agent-1',
        ['brand_ambassador'],
        'corr-ba'
      )
    ).resolves.toBeUndefined();
  });

  it('forbids another agent', async () => {
    prismaMock.customer.findUnique.mockResolvedValue({
      id: 'cust-1',
      createdBy: 'agent-1',
    });

    await expect(
      policyService.assertRecoveryAccessToCustomer(
        'cust-1',
        'agent-2',
        ['brand_ambassador'],
        'corr-deny'
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFound when customer is missing', async () => {
    prismaMock.customer.findUnique.mockResolvedValue(null);

    await expect(
      policyService.assertRecoveryAccessToCustomer(
        'missing',
        'agent-1',
        ['brand_ambassador'],
        'corr-404'
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
