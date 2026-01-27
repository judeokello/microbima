/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { MpesaIpnService } from '../../src/services/mpesa-ipn.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PolicyService } from '../../src/services/policy.service';
import { MpesaIpnPayloadDto, MpesaIpnResponseDto } from '../../src/dto/mpesa-ipn/mpesa-ipn.dto';
import { MpesaPaymentSource, MpesaStkPushStatus, MpesaStatementReasonType } from '@prisma/client';
import { ValidationException } from '../../src/exceptions/validation.exception';
import { Logger } from '@nestjs/common';

describe('MpesaIpnService', () => {
  let service: MpesaIpnService;
  let prismaService: jest.Mocked<PrismaService>;
  let policyService: jest.Mocked<PolicyService>;

  // Mock Prisma service methods
  const createPrismaMock = () => ({
    policyPayment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    mpesaPaymentReportItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    mpesaStkPushRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    policy: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  });

  // Mock Policy service methods
  const createPolicyServiceMock = () => ({
    activatePolicy: jest.fn(),
  });

  beforeEach(async () => {
    const prismaMock = createPrismaMock();
    const policyServiceMock = createPolicyServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpesaIpnService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: PolicyService,
          useValue: policyServiceMock,
        },
      ],
    })
      .setLogger(new Logger())
      .compile();

    service = module.get<MpesaIpnService>(MpesaIpnService);
    prismaService = module.get(PrismaService);
    policyService = module.get(PolicyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processIpnNotification', () => {
    const correlationId = 'test-correlation-id';
    const validPayload: MpesaIpnPayloadDto = {
      TransactionType: 'Pay Bill',
      TransID: 'RKTQDM7W6S',
      TransTime: '20250127143045',
      TransAmount: '100.00',
      BusinessShortCode: '174379',
      BillRefNumber: 'POL123456',
      MSISDN: '254722000000',
      FirstName: 'John',
      LastName: 'Doe',
    };

    it('should process new IPN notification and create payment records', async () => {
      // Setup: No existing records
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      });
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
        source: MpesaPaymentSource.IPN,
      });
      prismaService.policyPayment.create.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });

      const result = await service.processIpnNotification(validPayload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalled();
      expect(prismaService.policyPayment.create).toHaveBeenCalled();
    });

    it('should handle duplicate IPN notifications idempotently', async () => {
      // Setup: Both records already exist
      const existingPolicyPayment = {
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      };
      const existingIpnRecord = {
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
        source: MpesaPaymentSource.IPN,
      };

      prismaService.policyPayment.findFirst.mockResolvedValue(existingPolicyPayment);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(existingIpnRecord);
      prismaService.mpesaPaymentReportItem.update.mockResolvedValue(existingIpnRecord);
      prismaService.policyPayment.update.mockResolvedValue(existingPolicyPayment);

      const result = await service.processIpnNotification(validPayload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaPaymentReportItem.update).toHaveBeenCalled();
      expect(prismaService.policyPayment.update).toHaveBeenCalled();
      expect(prismaService.mpesaPaymentReportItem.create).not.toHaveBeenCalled();
      expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
    });

    it('should link IPN to STK Push request when match found', async () => {
      // Setup: STK Push request exists and matches
      const stkPushRequest = {
        id: 'stk-push-id',
        accountReference: 'POL123456',
        phoneNumber: '254722000000',
        amount: 100.0,
        status: MpesaStkPushStatus.PENDING,
        initiatedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      };

      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([stkPushRequest]);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
        mpesaStkPushRequestId: null,
      });
      prismaService.mpesaPaymentReportItem.update.mockResolvedValue({
        id: 'ipn-record-id',
        mpesaStkPushRequestId: 'stk-push-id',
      });
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      });
      prismaService.policyPayment.create.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });

      const result = await service.processIpnNotification(validPayload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaPaymentReportItem.update).toHaveBeenCalledWith({
        where: { id: 'ipn-record-id' },
        data: { mpesaStkPushRequestId: 'stk-push-id' },
      });
    });

    it('should skip policy payment creation if STK Push is already COMPLETED', async () => {
      // Setup: STK Push is COMPLETED, so payment was already created
      const stkPushRequest = {
        id: 'stk-push-id',
        accountReference: 'POL123456',
        phoneNumber: '254722000000',
        amount: 100.0,
        status: MpesaStkPushStatus.COMPLETED,
        initiatedAt: new Date(Date.now() - 1000 * 60 * 60),
      };

      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([stkPushRequest]);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
      });
      prismaService.mpesaPaymentReportItem.update.mockResolvedValue({
        id: 'ipn-record-id',
        mpesaStkPushRequestId: 'stk-push-id',
      });

      const result = await service.processIpnNotification(validPayload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalled();
      expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
    });

    it('should handle missing account reference gracefully', async () => {
      const payloadWithoutRef = {
        ...validPayload,
        BillRefNumber: undefined,
      };

      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
      });

      const result = await service.processIpnNotification(payloadWithoutRef, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalled();
      expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
    });

    it('should handle policy not found gracefully', async () => {
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
      });
      prismaService.policy.findFirst.mockResolvedValue(null);

      const result = await service.processIpnNotification(validPayload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalled();
      expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
    });

    it('should activate policy if status is PENDING_ACTIVATION', async () => {
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
      });
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'PENDING_ACTIVATION',
      });
      prismaService.policyPayment.create.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });
      policyService.activatePolicy.mockResolvedValue(undefined);

      const result = await service.processIpnNotification(validPayload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(policyService.activatePolicy).toHaveBeenCalledWith(1, correlationId);
    });

    it('should handle activation errors gracefully', async () => {
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
      });
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'PENDING_ACTIVATION',
      });
      prismaService.policyPayment.create.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });
      policyService.activatePolicy.mockRejectedValue(new Error('Activation failed'));

      // Should still return success even if activation fails
      const result = await service.processIpnNotification(validPayload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(policyService.activatePolicy).toHaveBeenCalled();
    });

    it('should always return success even on database errors', async () => {
      prismaService.policyPayment.findFirst.mockRejectedValue(new Error('Database error'));

      // Should catch error and return success to prevent M-Pesa retries
      const result = await service.processIpnNotification(validPayload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    });

    it('should parse transaction time correctly', async () => {
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      });

      const payloadWithSpecificTime: MpesaIpnPayloadDto = {
        ...validPayload,
        TransTime: '20250127143045', // Jan 27, 2025 14:30:45 UTC
      };

      prismaService.mpesaPaymentReportItem.create.mockImplementation((args) => {
        // Verify that completionTime is parsed correctly
        const parsedTime = args.data.completionTime;
        expect(parsedTime).toBeInstanceOf(Date);
        expect(parsedTime.getUTCFullYear()).toBe(2025);
        expect(parsedTime.getUTCMonth()).toBe(0); // January is 0
        expect(parsedTime.getUTCDate()).toBe(27);
        expect(parsedTime.getUTCHours()).toBe(14);
        expect(parsedTime.getUTCMinutes()).toBe(30);
        expect(parsedTime.getUTCSeconds()).toBe(45);

        return Promise.resolve({
          id: 'ipn-record-id',
          transactionReference: 'RKTQDM7W6S',
        });
      });
      prismaService.policyPayment.create.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });

      await service.processIpnNotification(payloadWithSpecificTime, correlationId);

      expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalled();
    });

    it('should map transaction types to reason types correctly', async () => {
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      });

      const testCases = [
        { transactionType: 'Pay Bill', expectedReasonType: MpesaStatementReasonType.PayBill_STK },
        { transactionType: 'Buy Goods', expectedReasonType: MpesaStatementReasonType.PayBill_STK },
        { transactionType: 'CustomerPayBillOnline', expectedReasonType: MpesaStatementReasonType.Paybill_MobileApp },
        { transactionType: 'Unknown Type', expectedReasonType: MpesaStatementReasonType.Unmapped },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
          id: 'ipn-record-id',
          transactionReference: 'RKTQDM7W6S',
        });
        prismaService.policyPayment.create.mockResolvedValue({
          id: 1,
          transactionReference: 'RKTQDM7W6S',
        });

        const payload: MpesaIpnPayloadDto = {
          ...validPayload,
          TransactionType: testCase.transactionType,
        };

        await service.processIpnNotification(payload, correlationId);

        expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            reasonType: testCase.expectedReasonType,
          }),
        });
      }
    });

    it('should normalize phone numbers correctly', async () => {
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      });
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'ipn-record-id',
        transactionReference: 'RKTQDM7W6S',
      });
      prismaService.policyPayment.create.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });

      const payloadWithLocalPhone: MpesaIpnPayloadDto = {
        ...validPayload,
        MSISDN: '0722000000', // Local format
      };

      await service.processIpnNotification(payloadWithLocalPhone, correlationId);

      expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          msisdn: '254722000000', // Should be normalized
        }),
      });
    });
  });
});






