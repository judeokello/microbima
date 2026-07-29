import * as Sentry from '@sentry/nestjs';
import { MessagingService } from '../messaging.service';

jest.mock('@sentry/nestjs', () => ({
  captureMessage: jest.fn(),
}));

describe('MessagingService.enqueue non-prod redirect', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  const prisma = {
    messagingRoute: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
    messagingDelivery: { create: jest.fn() },
  };

  const systemSettings = {
    getSnapshot: jest.fn().mockResolvedValue({
      defaultMessagingLanguage: 'en',
      smsMaxAttempts: 3,
      emailMaxAttempts: 3,
    }),
  };

  const supabaseService = {
    getUserMessagingContacts: jest.fn(),
  };

  let service: MessagingService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    prisma.messagingRoute.findUnique.mockResolvedValue({
      templateKey: 'customer_created',
      smsEnabled: true,
      emailEnabled: false,
      isActive: true,
    });
    prisma.messagingDelivery.create.mockImplementation(async ({ data }: { data: { id?: string } }) => ({
      id: data.id ?? 'delivery-1',
      ...data,
    }));
    service = new MessagingService(
      prisma as never,
      systemSettings as never,
      supabaseService as never,
    );
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('redirects SMS to creator phone in development', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'cust-1',
      phoneNumber: '254700000001',
      email: 'cust@example.com',
      defaultMessagingLanguage: 'en',
      createdBy: 'user-ba-1',
    });
    supabaseService.getUserMessagingContacts.mockResolvedValue({
      phone: '254711111111',
      email: 'ba@example.com',
    });

    const result = await service.enqueue({
      templateKey: 'customer_created',
      customerId: 'cust-1',
      placeholderValues: { first_name: 'Jane' },
      correlationId: 'cid-1',
    });

    expect(result.createdDeliveryIds).toHaveLength(1);
    expect(prisma.messagingDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'SMS',
          recipientPhone: '254711111111',
          status: 'PENDING',
        }),
      }),
    );
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('skips enqueue and reports Sentry when createdBy is missing', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'cust-2',
      phoneNumber: '254700000002',
      email: null,
      defaultMessagingLanguage: 'en',
      createdBy: null,
    });

    const result = await service.enqueue({
      templateKey: 'customer_created',
      customerId: 'cust-2',
      placeholderValues: {},
      correlationId: 'cid-2',
    });

    expect(result.createdDeliveryIds).toEqual([]);
    expect(prisma.messagingDelivery.create).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('no createdBy'),
      expect.objectContaining({ level: 'error' }),
    );
  });

  it('skips enqueue and reports Sentry when creator phone is missing', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'cust-3',
      phoneNumber: '254700000003',
      email: null,
      defaultMessagingLanguage: 'en',
      createdBy: 'user-ba-2',
    });
    supabaseService.getUserMessagingContacts.mockResolvedValue({
      phone: null,
      email: 'ba2@example.com',
    });

    const result = await service.enqueue({
      templateKey: 'customer_created',
      customerId: 'cust-3',
      placeholderValues: {},
      correlationId: 'cid-3',
    });

    expect(result.createdDeliveryIds).toEqual([]);
    expect(prisma.messagingDelivery.create).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('user_metadata.phone missing'),
      expect.objectContaining({ level: 'error' }),
    );
  });

  it('uses customer phone in production', async () => {
    process.env.NODE_ENV = 'production';
    prisma.customer.findUnique.mockResolvedValue({
      id: 'cust-4',
      phoneNumber: '254700000004',
      email: null,
      defaultMessagingLanguage: 'en',
      createdBy: 'user-ba-3',
    });

    await service.enqueue({
      templateKey: 'customer_created',
      customerId: 'cust-4',
      placeholderValues: {},
      correlationId: 'cid-4',
    });

    expect(supabaseService.getUserMessagingContacts).not.toHaveBeenCalled();
    expect(prisma.messagingDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientPhone: '254700000004',
        }),
      }),
    );
  });

  it('leaves phone-only unmatched enqueue unchanged in development', async () => {
    const result = await service.enqueue({
      templateKey: 'payment_received_unmatched',
      overrideRecipientPhone: '254733333333',
      placeholderValues: { first_name: 'Payer' },
      correlationId: 'cid-5',
    });

    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    expect(supabaseService.getUserMessagingContacts).not.toHaveBeenCalled();
    expect(result.createdDeliveryIds).toHaveLength(1);
    expect(prisma.messagingDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientPhone: '254733333333',
          customerId: null,
        }),
      }),
    );
  });
});
