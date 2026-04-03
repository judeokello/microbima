/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MpesaStkPushService } from '../mpesa-stk-push.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MpesaDarajaApiService } from '../mpesa-daraja-api.service';
import { MpesaErrorMapperService } from '../mpesa-error-mapper.service';
import { ConfigurationService } from '../../config/configuration.service';
import { PolicyService } from '../policy.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  InitiateStkPushDto,
  StkPushCallbackDto,
} from '../../dto/mpesa-stk-push/mpesa-stk-push.dto';
import { MpesaStkPushStatus } from '@prisma/client';
import { ValidationException } from '../../exceptions/validation.exception';
import { ErrorCodes } from '../../enums/error-codes.enum';
import { Logger } from '@nestjs/common';
import { PaymentStatusGateway } from '../../gateways/payment-status.gateway';

describe('MpesaStkPushService', () => {
  let service: MpesaStkPushService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prismaService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mpesaDarajaApiService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mpesaErrorMapper: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _configService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _policyService: any;

  // Mock Prisma service methods
  const createPrismaMock = () => ({
    mpesaStkPushRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    mpesaStkPushCallbackResponse: {
      create: jest.fn(),
    },
    mpesaPaymentReportItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    policyPayment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    policy: {
      findFirst: jest.fn(),
    },
  });

  // Mock M-Pesa Daraja API service
  const createMpesaDarajaApiMock = () => ({
    initiateStkPush: jest.fn(),
  });

  // Mock M-Pesa Error Mapper service
  const createMpesaErrorMapperMock = () => ({
    mapResultCode: jest.fn(),
  });

  // Mock Configuration service
  const createConfigServiceMock = () => ({
    mpesa: {
      stkPushCallbackUrl: 'https://api.example.com/public/mpesa/stk-push-callback',
      stkPushTimeoutMinutes: 5,
      stkPushExpirationCheckIntervalMinutes: 2,
      stkPushQueryEnabled: true,
      stkPushWorkerQueryIntervalSeconds: 15,
      stkPushFirstQueryDelaySeconds: 40,
      stkPushQueryRetryDelaySeconds: 30,
      stkPushMaxQueryAttempts: 3,
    },
    jwt: {
      secret: 'test-jwt-secret',
      expiresIn: '90m',
    },
  });

  // Mock Policy service
  const createPolicyServiceMock = () => ({
    activatePolicy: jest.fn(),
  });

  /** WebSocket gateway (emit only; no real Socket.IO in unit tests) */
  const createPaymentStatusGatewayMock = () => ({
    emitPaymentStatusUpdate: jest.fn(),
  });

  /** Mock JwtService */
  const createJwtServiceMock = () => ({
    signAsync: jest.fn().mockResolvedValue('mock-ws-token'),
    verifyAsync: jest.fn(),
  });

  beforeEach(async () => {
    const prismaMock = createPrismaMock();
    const mpesaDarajaApiMock = createMpesaDarajaApiMock();
    const mpesaErrorMapperMock = createMpesaErrorMapperMock();
    const configServiceMock = createConfigServiceMock();
    const policyServiceMock = createPolicyServiceMock();
    const paymentStatusGatewayMock = createPaymentStatusGatewayMock();
    const jwtServiceMock = createJwtServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpesaStkPushService,
        {
          provide: PaymentStatusGateway,
          useValue: paymentStatusGatewayMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: MpesaDarajaApiService,
          useValue: mpesaDarajaApiMock,
        },
        {
          provide: MpesaErrorMapperService,
          useValue: mpesaErrorMapperMock,
        },
        {
          provide: ConfigurationService,
          useValue: configServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: PolicyService,
          useValue: policyServiceMock,
        },
        {
          provide: SchedulerRegistry,
          useValue: { addCronJob: jest.fn(), getCronJob: jest.fn(), deleteCronJob: jest.fn() },
        },
      ],
    })
      .setLogger(new Logger())
      .compile();

    service = module.get<MpesaStkPushService>(MpesaStkPushService);
    prismaService = module.get(PrismaService);
    mpesaDarajaApiService = module.get(MpesaDarajaApiService);
    mpesaErrorMapper = module.get(MpesaErrorMapperService);
    _configService = module.get(ConfigurationService);
    _policyService = module.get(PolicyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateStkPush', () => {
    const correlationId = 'test-correlation-id';
    const validDto: InitiateStkPushDto = {
      phoneNumber: '254722000000',
      amount: 100.0,
      accountReference: 'POL123456',
      transactionDesc: 'Premium payment',
    };

    it('should initiate STK Push successfully', async () => {
      const stkPushRequestId = 'stk-push-request-id';
      const checkoutRequestId = 'ws_CO_270120251430451234567890';

      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        paymentAcNumber: 'POL123456',
      });
      prismaService.mpesaStkPushRequest.create.mockResolvedValue({
        id: stkPushRequestId,
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        status: MpesaStkPushStatus.PENDING,
        initiatedAt: new Date(),
      });
      mpesaDarajaApiService.initiateStkPush.mockResolvedValue({
        CheckoutRequestID: checkoutRequestId,
        ResponseCode: '0',
        ResponseDescription: 'Success',
        MerchantRequestID: stkPushRequestId,
        CustomerMessage: 'Success',
        requestPayload: '{"BusinessShortCode":"174379",...}',
        responsePayload: '{"CheckoutRequestID":"ws_CO_...","ResponseCode":"0"}',
      });
      prismaService.mpesaStkPushRequest.update.mockResolvedValue({
        id: stkPushRequestId,
        checkoutRequestId,
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        status: MpesaStkPushStatus.PENDING,
        initiatedAt: new Date(),
      });

      const result = await service.initiateStkPush(validDto, correlationId);

      expect(result.id).toBe(stkPushRequestId);
      expect(result.checkoutRequestID).toBe(checkoutRequestId);
      expect(result.status).toBe(MpesaStkPushStatus.PENDING);
      expect(prismaService.mpesaStkPushRequest.create).toHaveBeenCalled();
      expect(mpesaDarajaApiService.initiateStkPush).toHaveBeenCalled();
      expect(prismaService.mpesaStkPushRequest.update).toHaveBeenCalledWith({
        where: { id: stkPushRequestId },
        data: expect.objectContaining({
          checkoutRequestId,
          // requestPayload and responsePayload also persisted when Daraja returns them
        }),
      });
    });

    it('should throw ValidationException if amount is too low', async () => {
      const invalidDto: InitiateStkPushDto = {
        ...validDto,
        amount: 0,
      };

      await expect(
        service.initiateStkPush(invalidDto, correlationId)
      ).rejects.toThrow(ValidationException);

      expect(prismaService.mpesaStkPushRequest.create).not.toHaveBeenCalled();
      expect(mpesaDarajaApiService.initiateStkPush).not.toHaveBeenCalled();
    });

    it('should throw ValidationException if amount is too high', async () => {
      const invalidDto: InitiateStkPushDto = {
        ...validDto,
        amount: 70001,
      };

      await expect(
        service.initiateStkPush(invalidDto, correlationId)
      ).rejects.toThrow(ValidationException);

      expect(prismaService.mpesaStkPushRequest.create).not.toHaveBeenCalled();
      expect(mpesaDarajaApiService.initiateStkPush).not.toHaveBeenCalled();
    });

    it('should throw ValidationException if policy not found', async () => {
      prismaService.policy.findFirst.mockResolvedValue(null);

      await expect(
        service.initiateStkPush(validDto, correlationId)
      ).rejects.toThrow(ValidationException);

      expect(prismaService.mpesaStkPushRequest.create).not.toHaveBeenCalled();
      expect(mpesaDarajaApiService.initiateStkPush).not.toHaveBeenCalled();
    });

    it('should normalize phone number', async () => {
      const dtoWithLocalPhone: InitiateStkPushDto = {
        ...validDto,
        phoneNumber: '0722000000', // Local format
      };

      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        paymentAcNumber: 'POL123456',
      });
      prismaService.mpesaStkPushRequest.create.mockResolvedValue({
        id: 'stk-push-request-id',
        phoneNumber: '254722000000', // Normalized
        amount: 100.0,
        accountReference: 'POL123456',
        status: MpesaStkPushStatus.PENDING,
        initiatedAt: new Date(),
      });
      mpesaDarajaApiService.initiateStkPush.mockResolvedValue({
        CheckoutRequestID: 'checkout-id',
        ResponseCode: '0',
        ResponseDescription: 'Success',
        MerchantRequestID: 'merchant-id',
        CustomerMessage: 'Success',
      });
      prismaService.mpesaStkPushRequest.update.mockResolvedValue({
        id: 'stk-push-request-id',
        checkoutRequestId: 'checkout-id',
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        status: MpesaStkPushStatus.PENDING,
        initiatedAt: new Date(),
      });

      await service.initiateStkPush(dtoWithLocalPhone, correlationId);

      expect(prismaService.mpesaStkPushRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phoneNumber: '254722000000', // Should be normalized
        }),
      });
      expect(mpesaDarajaApiService.initiateStkPush).toHaveBeenCalledWith(
        '254722000000', // Normalized phone number
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle M-Pesa API errors', async () => {
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        paymentAcNumber: 'POL123456',
      });
      prismaService.mpesaStkPushRequest.create.mockResolvedValue({
        id: 'stk-push-request-id',
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        status: MpesaStkPushStatus.PENDING,
        initiatedAt: new Date(),
      });
      mpesaDarajaApiService.initiateStkPush.mockRejectedValue(
        new ValidationException(ErrorCodes.MPESA_API_ERROR, 'M-Pesa API error')
      );

      await expect(
        service.initiateStkPush(validDto, correlationId)
      ).rejects.toThrow(ValidationException);

      expect(prismaService.mpesaStkPushRequest.create).toHaveBeenCalled();
      expect(mpesaDarajaApiService.initiateStkPush).toHaveBeenCalled();
    });
  });

  describe('handleStkPushCallback', () => {
    const correlationId = 'test-correlation-id';
    const checkoutRequestId = 'ws_CO_270120251430451234567890';
    const stkPushRequestId = 'stk-push-request-id';

    const createCallbackPayload = (resultCode: number, resultDesc: string): StkPushCallbackDto => ({
      Body: {
        stkCallback: {
          MerchantRequestID: stkPushRequestId,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: resultCode,
          ResultDesc: resultDesc,
          CallbackMetadata: resultCode === 0
            ? {
                Item: [
                  { Name: 'Amount', Value: '100.00' },
                  { Name: 'MpesaReceiptNumber', Value: 'RKTQDM7W6S' },
                  { Name: 'TransactionDate', Value: '20250127143045' },
                  { Name: 'PhoneNumber', Value: '254722000000' },
                ],
              }
            : undefined,
        },
      },
    });

    it('should handle successful STK Push callback (ResultCode: 0)', async () => {
      const payload = createCallbackPayload(0, 'The service request is processed successfully.');

      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue({
        id: stkPushRequestId,
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        transactionDesc: 'Premium payment',
        status: MpesaStkPushStatus.PENDING,
      });
      prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({
        id: 'callback-response-id',
        mpesaStkPushRequestId: stkPushRequestId,
        resultCode: 0,
        resultDesc: 'The service request is processed successfully.',
      });
      prismaService.mpesaStkPushRequest.update.mockResolvedValue({
        id: stkPushRequestId,
        status: MpesaStkPushStatus.COMPLETED,
        resultCode: '0',
        resultDesc: 'The service request is processed successfully.',
      });
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'payment-report-id',
        transactionReference: 'RKTQDM7W6S',
      });
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      });
      prismaService.policyPayment.findFirst.mockResolvedValue(null); // No placeholder
      prismaService.policyPayment.create.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });

      const result = await service.handleStkPushCallback(payload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaStkPushCallbackResponse.create).toHaveBeenCalled();
      expect(prismaService.mpesaStkPushRequest.update).toHaveBeenCalledWith({
        where: { id: stkPushRequestId },
        data: expect.objectContaining({
          status: MpesaStkPushStatus.COMPLETED,
        }),
      });
      expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalled();
      expect(prismaService.policyPayment.create).toHaveBeenCalled();
    });

    it('should handle failed STK Push callback (non-zero ResultCode)', async () => {
      const payload = createCallbackPayload(1032, 'Request cancelled by user');

      mpesaErrorMapper.mapResultCode.mockReturnValue({
        code: ErrorCodes.MPESA_REQUEST_CANCELLED,
        message: 'Request cancelled by user',
        userMessage: 'The payment request was cancelled by the user',
        context: {
          api: 'STK_PUSH',
          mpesaCode: 1032,
          mpesaMessage: 'Request cancelled by user',
          retryable: false,
        },
      });

      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue({
        id: stkPushRequestId,
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        transactionDesc: 'Premium payment',
        status: MpesaStkPushStatus.PENDING,
      });
      prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({
        id: 'callback-response-id',
        mpesaStkPushRequestId: stkPushRequestId,
        resultCode: 1032,
        resultDesc: 'Request cancelled by user',
      });
      prismaService.mpesaStkPushRequest.update.mockResolvedValue({
        id: stkPushRequestId,
        status: MpesaStkPushStatus.CANCELLED,
        resultCode: '1032',
        resultDesc: 'Request cancelled by user',
      });

      const result = await service.handleStkPushCallback(payload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaStkPushRequest.update).toHaveBeenCalledWith({
        where: { id: stkPushRequestId },
        data: expect.objectContaining({
          status: MpesaStkPushStatus.CANCELLED,
        }),
      });
      expect(prismaService.mpesaPaymentReportItem.create).not.toHaveBeenCalled();
      expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
    });

    it('should handle STK Push request not found', async () => {
      const payload = createCallbackPayload(0, 'Success');

      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(null);

      const result = await service.handleStkPushCallback(payload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaStkPushCallbackResponse.create).not.toHaveBeenCalled();
      expect(prismaService.mpesaStkPushRequest.update).not.toHaveBeenCalled();
    });

    it('should skip payment record creation if records already exist (IPN arrived first)', async () => {
      const payload = createCallbackPayload(0, 'Success');

      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue({
        id: stkPushRequestId,
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        transactionDesc: 'Premium payment',
        status: MpesaStkPushStatus.PENDING,
      });
      prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({
        id: 'callback-response-id',
        mpesaStkPushRequestId: stkPushRequestId,
        resultCode: 0,
        resultDesc: 'Success',
      });
      prismaService.mpesaStkPushRequest.update.mockResolvedValue({
        id: stkPushRequestId,
        status: MpesaStkPushStatus.COMPLETED,
      });
      prismaService.policyPayment.findFirst.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue({
        id: 'payment-report-id',
        transactionReference: 'RKTQDM7W6S',
        mpesaStkPushRequestId: null,
      });
      prismaService.mpesaPaymentReportItem.update.mockResolvedValue({
        id: 'payment-report-id',
        mpesaStkPushRequestId: stkPushRequestId,
      });

      const result = await service.handleStkPushCallback(payload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaPaymentReportItem.create).not.toHaveBeenCalled();
      expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
      expect(prismaService.mpesaPaymentReportItem.update).toHaveBeenCalledWith({
        where: { id: 'payment-report-id' },
        data: { mpesaStkPushRequestId: stkPushRequestId },
      });
    });

    it('should update placeholder payment if exists', async () => {
      const payload = createCallbackPayload(0, 'Success');

      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue({
        id: stkPushRequestId,
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        transactionDesc: 'Premium payment',
        status: MpesaStkPushStatus.PENDING,
      });
      prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({
        id: 'callback-response-id',
        mpesaStkPushRequestId: stkPushRequestId,
        resultCode: 0,
        resultDesc: 'Success',
      });
      prismaService.mpesaStkPushRequest.update.mockResolvedValue({
        id: stkPushRequestId,
        status: MpesaStkPushStatus.COMPLETED,
      });
      prismaService.policyPayment.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
      prismaService.mpesaPaymentReportItem.create.mockResolvedValue({
        id: 'payment-report-id',
        transactionReference: 'RKTQDM7W6S',
      });
      prismaService.policy.findFirst.mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
      });
      // First call returns null (no existing payment with real transaction reference)
      // Second call returns placeholder payment
      prismaService.policyPayment.findFirst
        .mockResolvedValueOnce(null) // No existing payment with mpesaReceiptNumber
        .mockResolvedValueOnce({
          id: 1,
          policyId: 1,
          transactionReference: 'PENDING-STK-stk-push-request-id',
          actualPaymentDate: null,
        });
      prismaService.policyPayment.update.mockResolvedValue({
        id: 1,
        transactionReference: 'RKTQDM7W6S',
      });

      const result = await service.handleStkPushCallback(payload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.policyPayment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          transactionReference: 'RKTQDM7W6S',
        }),
      });
      expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
    });

    it('should always return success even on errors', async () => {
      const payload = createCallbackPayload(0, 'Success');

      prismaService.mpesaStkPushRequest.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await service.handleStkPushCallback(payload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
    });

    it('should handle missing MpesaReceiptNumber in callback metadata', async () => {
      const payload: StkPushCallbackDto = {
        Body: {
          stkCallback: {
            MerchantRequestID: stkPushRequestId,
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: '100.00' },
                // Missing MpesaReceiptNumber
              ],
            },
          },
        },
      };

      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue({
        id: stkPushRequestId,
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        transactionDesc: 'Premium payment',
        status: MpesaStkPushStatus.PENDING,
      });
      prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({
        id: 'callback-response-id',
        mpesaStkPushRequestId: stkPushRequestId,
        resultCode: 0,
        resultDesc: 'Success',
      });
      prismaService.mpesaStkPushRequest.update.mockResolvedValue({
        id: stkPushRequestId,
        status: MpesaStkPushStatus.COMPLETED,
      });

      const result = await service.handleStkPushCallback(payload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaPaymentReportItem.create).not.toHaveBeenCalled();
      expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
    });

    it('should determine status as FAILED for non-zero ResultCode without "cancelled" in description', async () => {
      const payload = createCallbackPayload(1037, 'The transaction timed out');

      mpesaErrorMapper.mapResultCode.mockReturnValue({
        code: ErrorCodes.MPESA_TRANSACTION_EXPIRED,
        message: 'The transaction timed out',
        userMessage: 'The payment request has expired',
        context: {
          api: 'STK_PUSH',
          mpesaCode: 1037,
          mpesaMessage: 'The transaction timed out',
          retryable: true,
        },
      });

      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue({
        id: stkPushRequestId,
        phoneNumber: '254722000000',
        amount: 100.0,
        accountReference: 'POL123456',
        transactionDesc: 'Premium payment',
        status: MpesaStkPushStatus.PENDING,
      });
      prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({
        id: 'callback-response-id',
        mpesaStkPushRequestId: stkPushRequestId,
        resultCode: 1037,
        resultDesc: 'The transaction timed out',
      });
      prismaService.mpesaStkPushRequest.update.mockResolvedValue({
        id: stkPushRequestId,
        status: MpesaStkPushStatus.FAILED,
        resultCode: '1037',
        resultDesc: 'The transaction timed out',
      });

      const result = await service.handleStkPushCallback(payload, correlationId);

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(prismaService.mpesaStkPushRequest.update).toHaveBeenCalledWith({
        where: { id: stkPushRequestId },
        data: expect.objectContaining({
          status: MpesaStkPushStatus.FAILED,
        }),
      });
    });
  });

  describe('markExpiredStkPushRequests (T042)', () => {
    it('should find PENDING requests older than timeout and mark them EXPIRED', async () => {
      const cutoff = new Date();
      cutoff.setUTCMinutes(cutoff.getUTCMinutes() - 10);
      const expiredRows = [
        { id: 'exp-1', initiatedAt: cutoff, queryAttemptCount: 3 },
        { id: 'exp-2', initiatedAt: cutoff, queryAttemptCount: 3 },
      ];
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue(expiredRows);
      prismaService.mpesaStkPushRequest.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markExpiredStkPushRequests('cid-1');

      expect(result.expiredCount).toBe(2);
      expect(result.expiredRequestIds).toEqual(['exp-1', 'exp-2']);
      expect(prismaService.mpesaStkPushRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: MpesaStkPushStatus.PENDING,
          initiatedAt: { lt: expect.any(Date) },
          OR: [
            { nextQueryAt: null },
            { queryAttemptCount: { gte: 3 } },
          ],
        },
        select: { id: true, initiatedAt: true, queryAttemptCount: true },
      });
      expect(prismaService.mpesaStkPushRequest.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['exp-1', 'exp-2'] } },
        data: { status: MpesaStkPushStatus.EXPIRED },
      });
    });

    it('should return zero counts when no expired PENDING requests', async () => {
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);

      const result = await service.markExpiredStkPushRequests('cid-2');

      expect(result.expiredCount).toBe(0);
      expect(result.expiredRequestIds).toEqual([]);
      expect(prismaService.mpesaStkPushRequest.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('checkMissingIpn (T043)', () => {
    it('should find COMPLETED requests with no IPN within 24h and return their IDs', async () => {
      const rows = [
        {
          id: 'missing-1',
          completedAt: new Date(),
          accountReference: 'POL1',
          amount: 100,
        },
        {
          id: 'missing-2',
          completedAt: new Date(),
          accountReference: 'POL2',
          amount: 200,
        },
      ];
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue(rows);

      const result = await service.checkMissingIpn('cid-3');

      expect(result.missingIpnCount).toBe(2);
      expect(result.requestIds).toEqual(['missing-1', 'missing-2']);
      expect(prismaService.mpesaStkPushRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: MpesaStkPushStatus.COMPLETED,
          completedAt: { lt: expect.any(Date), not: null },
          linkedTransactionId: null,
        },
        select: { id: true, completedAt: true, accountReference: true, amount: true },
      });
    });

    it('should return zero counts when no missing-IPN requests', async () => {
      prismaService.mpesaStkPushRequest.findMany.mockResolvedValue([]);

      const result = await service.checkMissingIpn('cid-4');

      expect(result.missingIpnCount).toBe(0);
      expect(result.requestIds).toEqual([]);
    });
  });

  describe('getStkPushRequestById', () => {
    it('should return request when found', async () => {
      const req = {
        id: 'req-1',
        status: MpesaStkPushStatus.PENDING,
        initiatedAt: new Date(),
        completedAt: null,
        accountReference: 'POL1',
        phoneNumber: '254722000000',
        amount: 100,
        linkedTransactionId: null,
        checkoutRequestId: 'ws_CO_1',
      };
      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(req);

      const result = await service.getStkPushRequestById('req-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('req-1');
      expect(result?.status).toBe(MpesaStkPushStatus.PENDING);
      expect(result?.amount).toBe(100);
    });

    it('should return null when not found', async () => {
      prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(null);

      const result = await service.getStkPushRequestById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('PaymentStatus Implementation - Query API Flow', () => {
    describe('createPaymentRecordsFromQuery', () => {
      it('should create QUERY-PENDING payment and activate policy when query confirms success', async () => {
        const stkPushRequest = {
          id: 'stk-query-1',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'POL123456',
          transactionDesc: 'Test payment',
        };

        const policy = {
          id: 'policy-1',
          status: 'PENDING_ACTIVATION',
        };

        const placeholderPayment = {
          id: 'payment-1',
          transactionReference: 'PENDING-STK-123',
          actualPaymentDate: null,
        };

        prismaService.policy.findFirst.mockResolvedValue(policy);
        prismaService.policyPayment.findFirst.mockResolvedValue(placeholderPayment);
        prismaService.policyPayment.update.mockResolvedValue({});
        prismaService.mpesaPaymentReportItem.create.mockResolvedValue({});

        const mockPolicyService = {
          activatePolicy: jest.fn().mockResolvedValue(undefined),
        };
        (service as any).policyService = mockPolicyService;

        await (service as any).createPaymentRecordsFromQuery(stkPushRequest, 'test-cid');

        // Verify IPN record created with QUERY source
        expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            transactionReference: 'QUERY-PENDING-stk-query-1',
            source: 'QUERY',
            mpesaStkPushRequestId: 'stk-query-1',
            accountNumber: 'POL123456',
            msisdn: '254722000000',
            paidIn: 100,
          }),
        });

        // Verify placeholder payment updated with COMPLETED_PENDING_RECEIPT status
        expect(prismaService.policyPayment.update).toHaveBeenCalledWith({
          where: { id: 'payment-1' },
          data: expect.objectContaining({
            transactionReference: 'QUERY-PENDING-stk-query-1',
            paymentStatus: 'COMPLETED_PENDING_RECEIPT',
            actualPaymentDate: expect.any(Date),
          }),
        });

        // Verify policy activation was called
        expect(mockPolicyService.activatePolicy).toHaveBeenCalledWith('policy-1', 'test-cid');
      });

      it('should create new payment if no placeholder exists', async () => {
        const stkPushRequest = {
          id: 'stk-query-2',
          phoneNumber: '254722000000',
          amount: 200,
          accountReference: 'POL789',
          transactionDesc: null,
        };

        const policy = {
          id: 'policy-2',
          status: 'ACTIVE',
        };

        prismaService.policy.findFirst.mockResolvedValue(policy);
        prismaService.policyPayment.findFirst.mockResolvedValue(null);
        prismaService.policyPayment.create.mockResolvedValue({});
        prismaService.mpesaPaymentReportItem.create.mockResolvedValue({});

        await (service as any).createPaymentRecordsFromQuery(stkPushRequest, 'test-cid-2');

        // Verify new payment created with COMPLETED_PENDING_RECEIPT status
        expect(prismaService.policyPayment.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            policyId: 'policy-2',
            transactionReference: 'QUERY-PENDING-stk-query-2',
            paymentStatus: 'COMPLETED_PENDING_RECEIPT',
            actualPaymentDate: expect.any(Date),
          }),
        });
      });

      it('should not activate policy if already ACTIVE', async () => {
        const stkPushRequest = {
          id: 'stk-query-3',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'POL999',
          transactionDesc: 'Test',
        };

        const policy = {
          id: 'policy-3',
          status: 'ACTIVE',
        };

        prismaService.policy.findFirst.mockResolvedValue(policy);
        prismaService.policyPayment.findFirst.mockResolvedValue(null);
        prismaService.policyPayment.create.mockResolvedValue({});
        prismaService.mpesaPaymentReportItem.create.mockResolvedValue({});

        const mockPolicyService = {
          activatePolicy: jest.fn(),
        };
        (service as any).policyService = mockPolicyService;

        await (service as any).createPaymentRecordsFromQuery(stkPushRequest, 'test-cid-3');

        // Verify policy activation was NOT called
        expect(mockPolicyService.activatePolicy).not.toHaveBeenCalled();
      });

      it('should handle policy not found gracefully', async () => {
        const stkPushRequest = {
          id: 'stk-query-4',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'NONEXISTENT',
          transactionDesc: 'Test',
        };

        prismaService.policy.findFirst.mockResolvedValue(null);
        prismaService.mpesaPaymentReportItem.create.mockResolvedValue({});

        await (service as any).createPaymentRecordsFromQuery(stkPushRequest, 'test-cid-4');

        // Verify IPN record still created
        expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalled();

        // Verify no payment created
        expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
        expect(prismaService.policyPayment.update).not.toHaveBeenCalled();
      });
    });

    describe('Callback after Query - Update Flow', () => {
      it('should update QUERY-PENDING payment with real receipt when callback arrives', async () => {
        const stkPushRequest = {
          id: 'stk-1',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'POL123',
          transactionDesc: 'Test',
          status: MpesaStkPushStatus.COMPLETED,
          checkoutRequestId: 'ws_CO_123',
        };

        const queryPendingPayment = {
          id: 'payment-query-1',
          transactionReference: 'QUERY-PENDING-stk-1',
          paymentStatus: 'COMPLETED_PENDING_RECEIPT',
          paymentMessageBlob: JSON.stringify({ source: 'QUERY' }),
        };

        const queryIpnRecord = {
          id: 'ipn-query-1',
          transactionReference: 'QUERY-PENDING-stk-1',
          source: 'QUERY',
        };

        const callbackDto: StkPushCallbackDto = {
          Body: {
            stkCallback: {
              MerchantRequestID: 'merchant-123',
              CheckoutRequestID: 'ws_CO_123',
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: '100' },
                  { Name: 'MpesaReceiptNumber', Value: 'REAL123456' },
                  { Name: 'TransactionDate', Value: '20260402120000' },
                  { Name: 'PhoneNumber', Value: '254722000000' },
                ],
              },
            },
          },
        };

        prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(stkPushRequest);
        prismaService.policyPayment.findFirst
          .mockResolvedValueOnce(null) // No payment with real receipt (handleStkPushCallback check)
          .mockResolvedValueOnce(null) // No payment with real receipt (createPaymentRecordsFromStkPushCallback check)
          .mockResolvedValueOnce(queryPendingPayment); // Query-pending payment exists
        prismaService.mpesaPaymentReportItem.findFirst
          .mockResolvedValueOnce(null) // No existing IPN with real receipt
          .mockResolvedValueOnce(queryIpnRecord); // Query IPN record exists
        prismaService.policyPayment.update.mockResolvedValue({});
        prismaService.mpesaPaymentReportItem.update.mockResolvedValue({});
        prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({});
        prismaService.mpesaStkPushRequest.update.mockResolvedValue({
          ...stkPushRequest,
          status: MpesaStkPushStatus.COMPLETED,
        });

        const result = await service.handleStkPushCallback(callbackDto, 'test-cid');

        // Verify query-pending payment updated with real receipt
        expect(prismaService.policyPayment.update).toHaveBeenCalledWith({
          where: { id: 'payment-query-1' },
          data: expect.objectContaining({
            transactionReference: 'REAL123456',
            paymentStatus: 'COMPLETED',
            actualPaymentDate: expect.any(Date),
          }),
        });

        // Verify IPN record updated
        expect(prismaService.mpesaPaymentReportItem.update).toHaveBeenCalledWith({
          where: { id: 'ipn-query-1' },
          data: expect.objectContaining({
            transactionReference: 'REAL123456',
            source: 'IPN',
          }),
        });

        expect(result.ResultCode).toBe(0);
      });

      it('should skip duplicate callback if real receipt already exists', async () => {
        const stkPushRequest = {
          id: 'stk-2',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'POL456',
          transactionDesc: 'Test',
          status: MpesaStkPushStatus.COMPLETED,
          checkoutRequestId: 'ws_CO_456',
        };

        const existingPayment = {
          id: 'payment-2',
          transactionReference: 'REAL789',
          paymentStatus: 'COMPLETED',
        };

        const callbackDto: StkPushCallbackDto = {
          Body: {
            stkCallback: {
              MerchantRequestID: 'merchant-456',
              CheckoutRequestID: 'ws_CO_456',
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'MpesaReceiptNumber', Value: 'REAL789' },
                ],
              },
            },
          },
        };

        prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(stkPushRequest);
        prismaService.policyPayment.findFirst.mockResolvedValue(existingPayment);
        prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({});
        prismaService.mpesaStkPushRequest.update.mockResolvedValue(stkPushRequest);

        const result = await service.handleStkPushCallback(callbackDto, 'test-cid');

        // Verify no updates made (idempotent)
        expect(prismaService.policyPayment.update).not.toHaveBeenCalled();
        expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
        expect(result.ResultCode).toBe(0);
        expect(result.ResultDesc).toBe('Accepted');
      });

      it('should process callback normally if status is COMPLETED but no receipt exists', async () => {
        const stkPushRequest = {
          id: 'stk-3',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'POL789',
          transactionDesc: 'Test',
          status: MpesaStkPushStatus.COMPLETED,
          checkoutRequestId: 'ws_CO_789',
        };

        const callbackDto: StkPushCallbackDto = {
          Body: {
            stkCallback: {
              MerchantRequestID: 'merchant-789',
              CheckoutRequestID: 'ws_CO_789',
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: '100' },
                  { Name: 'MpesaReceiptNumber', Value: 'NEW123' },
                  { Name: 'TransactionDate', Value: '20260402120000' },
                  { Name: 'PhoneNumber', Value: '254722000000' },
                ],
              },
            },
          },
        };

        prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(stkPushRequest);
        prismaService.policyPayment.findFirst
          .mockResolvedValueOnce(null) // No payment with real receipt
          .mockResolvedValueOnce(null); // No query-pending payment
        prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({});
        prismaService.mpesaStkPushRequest.update.mockResolvedValue(stkPushRequest);

        const result = await service.handleStkPushCallback(callbackDto, 'test-cid');

        // Verify callback was stored
        expect(prismaService.mpesaStkPushCallbackResponse.create).toHaveBeenCalled();

        expect(result.ResultCode).toBe(0);
      });
    });

    describe('Callback First Flow - Traditional Path', () => {
      it.skip('should create payment with COMPLETED status when callback arrives first', async () => {
        const stkPushRequest = {
          id: 'stk-callback-1',
          phoneNumber: '254722000000',
          amount: 150,
          accountReference: 'POL111',
          transactionDesc: 'Callback first',
          status: MpesaStkPushStatus.PENDING,
          checkoutRequestId: 'ws_CO_111',
        };

        const _policy = {
          id: 'policy-callback-1',
          status: 'PENDING_ACTIVATION',
        };

        const placeholderPayment = {
          id: 'payment-placeholder-1',
          transactionReference: 'PENDING-STK-111',
          actualPaymentDate: null,
        };

        const callbackDto: StkPushCallbackDto = {
          Body: {
            stkCallback: {
              MerchantRequestID: 'merchant-111',
              CheckoutRequestID: 'ws_CO_111',
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: '150' },
                  { Name: 'MpesaReceiptNumber', Value: 'CALLBACK123' },
                  { Name: 'TransactionDate', Value: '20260402140000' },
                  { Name: 'PhoneNumber', Value: '254722000000' },
                ],
              },
            },
          },
        };

        prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(stkPushRequest);
        prismaService.policyPayment.findFirst
          .mockResolvedValueOnce(null) // No payment with real receipt (handleStkPushCallback check)
          .mockResolvedValueOnce(null) // No payment with real receipt (createPaymentRecordsFromStkPushCallback check)
          .mockResolvedValueOnce(null) // No query-pending payment
          .mockResolvedValueOnce(placeholderPayment); // Placeholder exists
        prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
        prismaService.mpesaPaymentReportItem.create.mockResolvedValue({});
        prismaService.policyPayment.update.mockResolvedValue({});
        prismaService.policy.findFirst.mockResolvedValue({
          id: 'policy-1',
          status: 'PENDING_ACTIVATION',
        });
        prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({});
        prismaService.mpesaStkPushRequest.update.mockResolvedValue({
          ...stkPushRequest,
          status: MpesaStkPushStatus.COMPLETED,
        });

        const mockPolicyService = {
          activatePolicy: jest.fn().mockResolvedValue(undefined),
        };
        (service as any).policyService = mockPolicyService;

        const result = await service.handleStkPushCallback(callbackDto, 'test-cid-callback');

        // Verify placeholder updated with COMPLETED status (not COMPLETED_PENDING_RECEIPT)
        expect(prismaService.policyPayment.update).toHaveBeenCalledWith({
          where: { id: 'payment-placeholder-1' },
          data: expect.objectContaining({
            transactionReference: 'CALLBACK123',
            paymentStatus: 'COMPLETED',
            actualPaymentDate: expect.any(Date),
          }),
        });

        // Verify IPN created with IPN source (not QUERY)
        expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            transactionReference: 'CALLBACK123',
            source: 'IPN',
          }),
        });

        expect(mockPolicyService.activatePolicy).toHaveBeenCalled();
        expect(result.ResultCode).toBe(0);
      });
    });

    describe('Payment Status Transitions', () => {
      it('should transition from PENDING_STK_CALLBACK to COMPLETED on callback', async () => {
        const stkPushRequest = {
          id: 'stk-transition-1',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'POL222',
          transactionDesc: 'Transition test',
          status: MpesaStkPushStatus.PENDING,
          checkoutRequestId: 'ws_CO_222',
        };

        const policy = { id: 'policy-trans-1', status: 'PENDING_ACTIVATION' };
        const placeholderPayment = {
          id: 'payment-trans-1',
          transactionReference: 'PENDING-STK-222',
          paymentStatus: 'PENDING_STK_CALLBACK',
          actualPaymentDate: null,
        };

        const callbackDto: StkPushCallbackDto = {
          Body: {
            stkCallback: {
              MerchantRequestID: 'merchant-222',
              CheckoutRequestID: 'ws_CO_222',
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'MpesaReceiptNumber', Value: 'TRANS123' },
                  { Name: 'TransactionDate', Value: '20260402150000' },
                ],
              },
            },
          },
        };

        prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(stkPushRequest);
        prismaService.policyPayment.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(placeholderPayment);
        prismaService.policy.findFirst.mockResolvedValue(policy);
        prismaService.mpesaPaymentReportItem.findFirst.mockResolvedValue(null);
        prismaService.mpesaPaymentReportItem.create.mockResolvedValue({});
        prismaService.policyPayment.update.mockResolvedValue({});
        prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({});
        prismaService.mpesaStkPushRequest.update.mockResolvedValue({});

        await service.handleStkPushCallback(callbackDto, 'test-trans-cid');

        // Verify status transition
        expect(prismaService.policyPayment.update).toHaveBeenCalledWith({
          where: { id: 'payment-trans-1' },
          data: expect.objectContaining({
            paymentStatus: 'COMPLETED',
            transactionReference: 'TRANS123',
          }),
        });
      });

      it('should transition from COMPLETED_PENDING_RECEIPT to COMPLETED on callback', async () => {
        const stkPushRequest = {
          id: 'stk-transition-2',
          phoneNumber: '254722000000',
          amount: 200,
          accountReference: 'POL333',
          transactionDesc: 'Query then callback',
          status: MpesaStkPushStatus.COMPLETED,
          checkoutRequestId: 'ws_CO_333',
        };

        const queryPendingPayment = {
          id: 'payment-query-2',
          transactionReference: 'QUERY-PENDING-stk-transition-2',
          paymentStatus: 'COMPLETED_PENDING_RECEIPT',
          paymentMessageBlob: JSON.stringify({ source: 'QUERY' }),
        };

        const callbackDto: StkPushCallbackDto = {
          Body: {
            stkCallback: {
              MerchantRequestID: 'merchant-333',
              CheckoutRequestID: 'ws_CO_333',
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'MpesaReceiptNumber', Value: 'FINAL789' },
                  { Name: 'TransactionDate', Value: '20260402160000' },
                ],
              },
            },
          },
        };

        prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(stkPushRequest);
        prismaService.policyPayment.findFirst
          .mockResolvedValueOnce(null) // No payment with real receipt (handleStkPushCallback check)
          .mockResolvedValueOnce(null) // No payment with real receipt (createPaymentRecordsFromStkPushCallback check)
          .mockResolvedValueOnce(queryPendingPayment); // Query-pending payment
        prismaService.mpesaPaymentReportItem.findFirst
          .mockResolvedValueOnce(null) // No existing IPN with real receipt
          .mockResolvedValueOnce({
            id: 'ipn-2',
            transactionReference: 'QUERY-PENDING-stk-transition-2',
            source: 'QUERY',
          });
        prismaService.policyPayment.update.mockResolvedValue({});
        prismaService.mpesaPaymentReportItem.update.mockResolvedValue({});
        prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({});
        prismaService.mpesaStkPushRequest.update.mockResolvedValue({
          ...stkPushRequest,
          status: MpesaStkPushStatus.COMPLETED,
        });

        await service.handleStkPushCallback(callbackDto, 'test-trans-2-cid');

        // Verify transition from COMPLETED_PENDING_RECEIPT to COMPLETED
        expect(prismaService.policyPayment.update).toHaveBeenCalledWith({
          where: { id: 'payment-query-2' },
          data: expect.objectContaining({
            transactionReference: 'FINAL789',
            paymentStatus: 'COMPLETED',
          }),
        });
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle query processing when policy activation fails', async () => {
        const stkPushRequest = {
          id: 'stk-error-1',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'POL444',
          transactionDesc: 'Error test',
        };

        const policy = {
          id: 'policy-error-1',
          status: 'PENDING_ACTIVATION',
        };

        prismaService.policy.findFirst.mockResolvedValue(policy);
        prismaService.policyPayment.findFirst.mockResolvedValue(null);
        prismaService.policyPayment.create.mockResolvedValue({});
        prismaService.mpesaPaymentReportItem.create.mockResolvedValue({});

        const mockPolicyService = {
          activatePolicy: jest.fn().mockRejectedValue(new Error('Activation failed')),
        };
        (service as any).policyService = mockPolicyService;

        // Should not throw - error is logged but payment records are created
        await expect(
          (service as any).createPaymentRecordsFromQuery(stkPushRequest, 'test-error-cid')
        ).resolves.not.toThrow();

        // Verify payment was still created despite activation failure
        expect(prismaService.policyPayment.create).toHaveBeenCalled();
        expect(prismaService.mpesaPaymentReportItem.create).toHaveBeenCalled();
      });

      it('should handle callback with no CallbackMetadata gracefully', async () => {
        const stkPushRequest = {
          id: 'stk-no-meta',
          phoneNumber: '254722000000',
          amount: 100,
          accountReference: 'POL555',
          transactionDesc: 'No metadata',
          status: MpesaStkPushStatus.PENDING,
          checkoutRequestId: 'ws_CO_555',
        };

        const callbackDto: StkPushCallbackDto = {
          Body: {
            stkCallback: {
              MerchantRequestID: 'merchant-555',
              CheckoutRequestID: 'ws_CO_555',
              ResultCode: 1032,
              ResultDesc: 'Request cancelled by user',
              CallbackMetadata: undefined,
            },
          },
        };

        prismaService.mpesaStkPushRequest.findUnique.mockResolvedValue(stkPushRequest);
        prismaService.mpesaStkPushCallbackResponse.create.mockResolvedValue({});
        prismaService.mpesaStkPushRequest.update.mockResolvedValue(stkPushRequest);

        const result = await service.handleStkPushCallback(callbackDto, 'test-no-meta-cid');

        // Verify callback stored but no payment created (failed transaction)
        expect(prismaService.mpesaStkPushCallbackResponse.create).toHaveBeenCalled();
        expect(prismaService.policyPayment.create).not.toHaveBeenCalled();
        expect(result.ResultCode).toBe(0);
      });
    });
  });
});

