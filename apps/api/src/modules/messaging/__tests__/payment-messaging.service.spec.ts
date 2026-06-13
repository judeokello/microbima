import { PaymentStatus } from '@prisma/client';
import { PaymentMessagingService } from '../payment-messaging.service';

describe('PaymentMessagingService', () => {
  const messagingService = { enqueue: jest.fn() };
  const systemSettings = {
    getSnapshot: jest.fn().mockResolvedValue({
      defaultSystemCurrency: 'Kes',
      general_support_number: '0746907934',
    }),
  };

  let prisma: {
    policyPayment: { findUnique: jest.Mock; update: jest.Mock };
    packageSchemeCustomer: { findFirst: jest.Mock };
    messagingDelivery: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  let service: PaymentMessagingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      policyPayment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      packageSchemeCustomer: { findFirst: jest.fn() },
      messagingDelivery: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          policyPayment: {
            findUnique: jest.fn().mockResolvedValue({ paymentSmsEnqueuedAt: null }),
            update: jest.fn(),
          },
        }),
      ),
    };
    service = new PaymentMessagingService(
      prisma as never,
      messagingService as never,
      systemSettings as never,
    );
  });

  it('skips when paymentSmsEnqueuedAt is already set', async () => {
    prisma.policyPayment.findUnique.mockResolvedValue({
      id: 1,
      paymentSmsEnqueuedAt: new Date(),
      paymentStatus: PaymentStatus.COMPLETED,
      amount: 1500,
      paymentType: 'MPESA',
      transactionReference: 'ABC123',
      policy: {
        id: 'policy-1',
        customerId: 'cust-1',
        packageId: 1,
        productName: 'MfanisiGo',
        policyNumber: 'P001',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        customer: { id: 'cust-1', firstName: 'Jane', lastName: 'Doe' },
      },
    });

    await service.tryEnqueueMatchedPaymentSms({
      policyPaymentId: 1,
      wasPendingActivation: true,
      activationSucceeded: true,
      correlationId: 'cid',
    });

    expect(messagingService.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues activation template with receipt for COMPLETED first payment', async () => {
    prisma.policyPayment.findUnique.mockResolvedValue({
      id: 2,
      paymentSmsEnqueuedAt: null,
      paymentStatus: PaymentStatus.COMPLETED,
      amount: 1500,
      paymentType: 'MPESA',
      transactionReference: 'QWE123',
      policy: {
        id: 'policy-2',
        customerId: 'cust-2',
        packageId: 1,
        productName: 'MfanisiGo Silver',
        policyNumber: 'P002',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        customer: { id: 'cust-2', firstName: 'John', lastName: 'Doe' },
      },
    });
    prisma.packageSchemeCustomer.findFirst.mockResolvedValue({
      packageScheme: { generalSchemeWaitingPeriod: 30 },
    });

    await service.tryEnqueueMatchedPaymentSms({
      policyPaymentId: 2,
      wasPendingActivation: true,
      activationSucceeded: true,
      correlationId: 'cid-2',
    });

    expect(messagingService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'payment_received_activation',
        customerId: 'cust-2',
        placeholderValues: expect.objectContaining({
          payment_reference: 'QWE123',
          amount: 'Kes 1,500',
          scheme_waiting_period: '30',
        }),
      }),
    );
  });

  it('enqueues pending-receipt regular template without payment_reference', async () => {
    prisma.policyPayment.findUnique.mockResolvedValue({
      id: 3,
      paymentSmsEnqueuedAt: null,
      paymentStatus: PaymentStatus.COMPLETED_PENDING_RECEIPT,
      amount: 2000,
      paymentType: 'MPESA',
      transactionReference: 'QUERY-PENDING-stk-1',
      policy: {
        id: 'policy-3',
        customerId: 'cust-3',
        packageId: 1,
        productName: 'MfanisiGo Gold',
        policyNumber: 'P003',
        startDate: new Date('2026-02-01T00:00:00.000Z'),
        customer: { id: 'cust-3', firstName: 'Ann', lastName: 'Kay' },
      },
    });

    await service.tryEnqueueMatchedPaymentSms({
      policyPaymentId: 3,
      wasPendingActivation: false,
      activationSucceeded: true,
      correlationId: 'cid-3',
    });

    expect(messagingService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'payment_received_pending_receipt',
      }),
    );
    const call = messagingService.enqueue.mock.calls[0][0];
    expect(call.placeholderValues.payment_reference).toBeUndefined();
  });

  it('skips SMS when activation failed for pending activation policy', async () => {
    prisma.policyPayment.findUnique.mockResolvedValue({
      id: 4,
      paymentSmsEnqueuedAt: null,
      paymentStatus: PaymentStatus.COMPLETED,
      amount: 1500,
      paymentType: 'MPESA',
      transactionReference: 'FAIL123',
      policy: {
        id: 'policy-4',
        customerId: 'cust-4',
        packageId: 1,
        productName: 'MfanisiGo',
        policyNumber: null,
        startDate: null,
        customer: { id: 'cust-4', firstName: 'Sam', lastName: 'Lee' },
      },
    });

    await service.tryEnqueueMatchedPaymentSms({
      policyPaymentId: 4,
      wasPendingActivation: true,
      activationSucceeded: false,
      correlationId: 'cid-4',
    });

    expect(messagingService.enqueue).not.toHaveBeenCalled();
  });

  it('skips unmatched SMS for hashed MSISDN', async () => {
    const hashed = 'a'.repeat(64);
    await service.tryEnqueueUnmatchedPaymentSms({
      firstName: 'X',
      lastName: 'Y',
      phone: hashed,
      amount: 500,
      paymentType: 'MPESA',
      paymentReference: 'TX1',
      correlationId: 'cid-u',
    });
    expect(messagingService.enqueue).not.toHaveBeenCalled();
  });
});
