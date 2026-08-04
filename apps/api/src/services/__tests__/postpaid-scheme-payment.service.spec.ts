/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';
import { PaymentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PolicyService } from '../policy.service';
import { PolicyLifecycleService } from '../policy-lifecycle.service';
import { PaymentMessagingService } from '../../modules/messaging/payment-messaging.service';
import { SupabaseService } from '../supabase.service';
import {
  parsePostpaidPaymentCsv,
  PostpaidSchemePaymentService,
} from '../postpaid-scheme-payment.service';

describe('parsePostpaidPaymentCsv', () => {
  it('parses header + data rows', () => {
    const csv = [
      'Name,phone number,amount,id number,paid date',
      'Sharon,254700000000,10000,36783633,2026-07-29',
    ].join('\n');
    const rows = parsePostpaidPaymentCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Sharon',
      phoneNumber: '254700000000',
      amount: 10000,
      idNumber: '36783633',
      paidDate: '2026-07-29',
    });
  });
});

describe('PostpaidSchemePaymentService - lookupMpesaTransactionReference', () => {
  const prismaMock = {
    scheme: { findUnique: jest.fn() },
    mpesaPaymentReportItem: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    postpaidSchemePayment: { findMany: jest.fn() },
    customer: { findFirst: jest.fn() },
    packageSchemeCustomer: { findFirst: jest.fn() },
    policy: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new PostpaidSchemePaymentService(
    prismaMock as unknown as PrismaService,
    {} as PolicyService,
    { getClient: jest.fn() } as unknown as SupabaseService,
    { notifyMatchedPaymentSmsAsync: jest.fn() } as unknown as PaymentMessagingService,
    { applyPaymentToPolicyLifecycle: jest.fn() } as unknown as PolicyLifecycleService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects empty transaction reference', async () => {
    const result = await service.lookupMpesaTransactionReference('   ', 'corr');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Transaction reference is required');
    expect(prismaMock.mpesaPaymentReportItem.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when IPN row is missing', async () => {
    prismaMock.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
    const result = await service.lookupMpesaTransactionReference('UGTPM18EP7', 'corr');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No M-Pesa payment found');
    expect(result.displayLabel).toBeNull();
  });

  it('rejects when IPN row is already mapped', async () => {
    prismaMock.mpesaPaymentReportItem.findFirst.mockResolvedValue({
      id: 'item-1',
      transactionReference: 'UGTPM18EP7',
      firstName: 'Sharon',
      middleName: 'Chepkorir',
      lastName: 'Ng\'etich',
      completionTime: new Date('2026-07-29T12:00:22.000Z'),
      isMapped: true,
    });
    const result = await service.lookupMpesaTransactionReference('UGTPM18EP7', 'corr');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already mapped');
    expect(result.displayLabel).toBeNull();
  });

  it('rejects when completionTime is missing', async () => {
    prismaMock.mpesaPaymentReportItem.findFirst.mockResolvedValue({
      id: 'item-1',
      transactionReference: 'UGTPM18EP7',
      firstName: 'Sharon',
      middleName: null,
      lastName: 'Ng\'etich',
      completionTime: null,
      isMapped: false,
    });
    const result = await service.lookupMpesaTransactionReference('UGTPM18EP7', 'corr');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no completion time');
  });

  it('returns valid display label for unmapped IPN', async () => {
    prismaMock.mpesaPaymentReportItem.findFirst.mockResolvedValue({
      id: 'item-1',
      transactionReference: 'UGTPM18EP7',
      firstName: 'Sharon',
      middleName: 'Chepkorir',
      lastName: 'Ng\'etich',
      completionTime: new Date('2026-07-29T12:00:22.000Z'),
      isMapped: false,
    });
    const result = await service.lookupMpesaTransactionReference('UGTPM18EP7', 'corr');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.payerName).toBe('Sharon Chepkorir Ng\'etich');
    expect(result.displayLabel).toMatch(/^Valid M-Pesa payment: Sharon Chepkorir Ng'etich — /);
    expect(result.completionTime).toBe('2026-07-29T12:00:22.000Z');
  });
});

describe('PostpaidSchemePaymentService - validateCsvAndAmount MPESA', () => {
  const prismaMock = {
    scheme: { findUnique: jest.fn() },
    mpesaPaymentReportItem: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    customer: { findFirst: jest.fn() },
    packageSchemeCustomer: { findFirst: jest.fn() },
    policy: { findFirst: jest.fn() },
  };

  const service = new PostpaidSchemePaymentService(
    prismaMock as unknown as PrismaService,
    {} as PolicyService,
    { getClient: jest.fn() } as unknown as SupabaseService,
    { notifyMatchedPaymentSmsAsync: jest.fn() } as unknown as PaymentMessagingService,
    { applyPaymentToPolicyLifecycle: jest.fn() } as unknown as PolicyLifecycleService
  );

  const csvRows = [
    {
      name: 'Sharon',
      phoneNumber: '254700000000',
      amount: 10000,
      amountRaw: '10000',
      idNumber: '36783633',
      paidDate: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.scheme.findUnique.mockResolvedValue({
      id: 1,
      isPostpaid: true,
      packageSchemes: [{ id: 10, packageId: 1 }],
    });
    prismaMock.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    prismaMock.packageSchemeCustomer.findFirst.mockResolvedValue({
      id: 1,
      packageScheme: { packageId: 1 },
    });
    prismaMock.policy.findFirst.mockResolvedValue({
      id: 'pol-1',
      paymentAcNumber: '36783633',
    });
  });

  it('fails validation when MPESA ref is already mapped', async () => {
    prismaMock.mpesaPaymentReportItem.findFirst.mockResolvedValue({
      id: 'item-1',
      transactionReference: 'UGTPM18EP7',
      firstName: 'Sharon',
      middleName: null,
      lastName: 'Ng\'etich',
      completionTime: new Date('2026-07-29T12:00:22.000Z'),
      isMapped: true,
    });

    const result = await service.validateCsvAndAmount(
      1,
      {
        amount: 10000,
        transactionReference: 'UGTPM18EP7',
        paymentType: PaymentType.MPESA,
      },
      csvRows,
      'corr'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('already mapped'))).toBe(true);
    }
  });

  it('passes MPESA validation when IPN is unmapped and CSV matches', async () => {
    prismaMock.mpesaPaymentReportItem.findFirst.mockResolvedValue({
      id: 'item-1',
      transactionReference: 'UGTPM18EP7',
      firstName: 'Sharon',
      middleName: null,
      lastName: 'Ng\'etich',
      completionTime: new Date('2026-07-29T12:00:22.000Z'),
      isMapped: false,
    });

    const result = await service.validateCsvAndAmount(
      1,
      {
        amount: 10000,
        transactionReference: 'UGTPM18EP7',
        paymentType: PaymentType.MPESA,
      },
      csvRows,
      'corr'
    );

    expect(result).toEqual({ valid: true });
  });

  it('skips IPN lookup for non-MPESA payment types', async () => {
    const result = await service.validateCsvAndAmount(
      1,
      {
        amount: 10000,
        transactionReference: 'CHQ-001',
        paymentType: PaymentType.CHEQUE,
      },
      csvRows,
      'corr'
    );

    expect(result).toEqual({ valid: true });
    expect(prismaMock.mpesaPaymentReportItem.findFirst).not.toHaveBeenCalled();
  });
});

describe('PostpaidSchemePaymentService - create marks IPN mapped', () => {
  const txMock = {
    postpaidSchemePayment: { create: jest.fn() },
    packageScheme: { findMany: jest.fn() },
    customer: { findFirst: jest.fn() },
    packageSchemeCustomer: { findFirst: jest.fn() },
    policy: { findFirst: jest.fn() },
    policyPayment: { create: jest.fn() },
    postpaidSchemePaymentItem: { create: jest.fn() },
    mpesaPaymentReportItem: { updateMany: jest.fn() },
  };

  const prismaMock = {
    scheme: { findUnique: jest.fn() },
    mpesaPaymentReportItem: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    customer: { findFirst: jest.fn() },
    packageSchemeCustomer: { findFirst: jest.fn() },
    policy: { findFirst: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  };

  const policyServiceMock = {
    activatePolicy: jest.fn(),
  };

  const supabaseMock = {
    getClient: jest.fn(() => ({
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn().mockResolvedValue({ error: null }),
        })),
      },
    })),
  };

  const paymentMessagingMock = {
    notifyMatchedPaymentSmsAsync: jest.fn(),
  };

  const lifecycleMock = {
    applyPaymentToPolicyLifecycle: jest.fn().mockResolvedValue(undefined),
  };

  const service = new PostpaidSchemePaymentService(
    prismaMock as unknown as PrismaService,
    policyServiceMock as unknown as PolicyService,
    supabaseMock as unknown as SupabaseService,
    paymentMessagingMock as unknown as PaymentMessagingService,
    lifecycleMock as unknown as PolicyLifecycleService
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.scheme.findUnique
      .mockResolvedValueOnce({
        id: 1,
        isPostpaid: true,
        packageSchemes: [{ id: 10, packageId: 1 }],
      })
      .mockResolvedValueOnce({ id: 1, schemeName: 'ALTO' });
    prismaMock.mpesaPaymentReportItem.findFirst.mockResolvedValue({
      id: 'item-1',
      transactionReference: 'UGTPM18EP7',
      firstName: 'Sharon',
      middleName: null,
      lastName: 'Ng\'etich',
      completionTime: new Date('2026-07-29T12:00:22.000Z'),
      isMapped: false,
    });
    prismaMock.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    prismaMock.packageSchemeCustomer.findFirst.mockResolvedValue({
      id: 1,
      packageScheme: { packageId: 1 },
    });
    prismaMock.policy.findFirst.mockResolvedValue({
      id: 'pol-1',
      paymentAcNumber: '36783633',
    });

    txMock.postpaidSchemePayment.create.mockResolvedValue({
      id: 19,
      schemeId: 1,
      amount: 10000,
      paymentType: PaymentType.MPESA,
      transactionReference: 'UGTPM18EP7',
      transactionDate: new Date('2026-07-29T00:00:00.000Z'),
      createdBy: 'user-1',
      createdAt: new Date('2026-07-31T08:22:14.000Z'),
      updatedAt: new Date('2026-07-31T08:22:14.000Z'),
    });
    txMock.packageScheme.findMany.mockResolvedValue([{ id: 10, packageId: 1 }]);
    txMock.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    txMock.packageSchemeCustomer.findFirst.mockResolvedValue({
      id: 1,
      packageScheme: { packageId: 1 },
    });
    txMock.policy.findFirst.mockResolvedValue({
      id: 'pol-1',
      status: 'ACTIVE',
      paymentAcNumber: '36783633',
    });
    txMock.policyPayment.create.mockResolvedValue({ id: 9859 });
    txMock.postpaidSchemePaymentItem.create.mockResolvedValue({ id: 193 });
    txMock.mpesaPaymentReportItem.updateMany.mockResolvedValue({ count: 1 });
  });

  it('marks matching IPN rows as mapped after MPESA create', async () => {
    const csv = Buffer.from(
      'Name,phone number,amount,id number\nSharon,254700000000,10000,36783633\n',
      'utf-8'
    );

    await service.create(
      1,
      {
        amount: 10000,
        paymentType: PaymentType.MPESA,
        transactionReference: 'UGTPM18EP7',
        transactionDate: '2026-07-29T00:00:00.000Z',
      },
      csv,
      'user-1',
      'corr'
    );

    expect(txMock.mpesaPaymentReportItem.updateMany).toHaveBeenCalledWith({
      where: { transactionReference: 'UGTPM18EP7' },
      data: { isMapped: true, isProcessed: true },
    });
  });

  it('rejects create when MPESA ref is already mapped', async () => {
    prismaMock.mpesaPaymentReportItem.findFirst.mockResolvedValue({
      id: 'item-1',
      transactionReference: 'UGTPM18EP7',
      firstName: 'Sharon',
      middleName: null,
      lastName: 'Ng\'etich',
      completionTime: new Date('2026-07-29T12:00:22.000Z'),
      isMapped: true,
    });

    const csv = Buffer.from(
      'Name,phone number,amount,id number\nSharon,254700000000,10000,36783633\n',
      'utf-8'
    );

    await expect(
      service.create(
        1,
        {
          amount: 10000,
          paymentType: PaymentType.MPESA,
          transactionReference: 'UGTPM18EP7',
          transactionDate: '2026-07-29T00:00:00.000Z',
        },
        csv,
        'user-1',
        'corr'
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
