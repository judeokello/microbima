/**
 * E2E tests for M-Pesa callback endpoints (T037).
 * - IPN confirmation: POST /api/public/mpesa/confirmation
 * - STK Push callback: POST /api/public/mpesa/stk-push/callback
 * - IP whitelist guard allows localhost in non-production (development/test).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ConfigurationService } from '../../src/config/configuration.service';
import { ExternalIntegrationsService } from '../../src/services/external-integrations.service';
import { GlobalExceptionFilter } from '../../src/filters/global-exception.filter';

describe('M-Pesa Callbacks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const configService = app.get(ConfigurationService);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    const externalIntegrationsService = app.get(ExternalIntegrationsService);
    app.useGlobalFilters(new GlobalExceptionFilter(externalIntegrationsService));

    app.setGlobalPrefix(configService.apiPrefix, {
      exclude: ['/health', '/internal/bootstrap', '/internal/bootstrap/*'],
    });

    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/public/mpesa/confirmation (IPN)', () => {
    const validIpnPayload = {
      TransactionType: 'Pay Bill',
      TransID: 'E2E-TEST-' + Date.now(),
      TransTime: '20250127143045',
      TransAmount: '100.00',
      BusinessShortCode: '174379',
      BillRefNumber: 'POL123456',
      MSISDN: '254722000000',
      FirstName: 'John',
      LastName: 'Doe',
    };

    it('returns 200 and ResultCode 0 (Accepted)', () => {
      return request(app.getHttpServer())
        .post('/api/public/mpesa/confirmation')
        .set('Content-Type', 'application/json')
        .send(validIpnPayload)
        .expect([200, 201])
        .expect((res: { body: { ResultCode: number; ResultDesc: string } }) => {
          expect(res.body).toHaveProperty('ResultCode', 0);
          expect(res.body).toHaveProperty('ResultDesc', 'Accepted');
        });
    });

    it('returns 200 even with minimal required fields', () => {
      return request(app.getHttpServer())
        .post('/api/public/mpesa/confirmation')
        .set('Content-Type', 'application/json')
        .send({
          TransactionType: 'Pay Bill',
          TransID: 'E2E-MIN-' + Date.now(),
          TransTime: '20250127143045',
          TransAmount: '50.00',
          BusinessShortCode: '174379',
          MSISDN: '254733000000',
        })
        .expect([200, 201])
        .expect((res: { body: { ResultCode: number; ResultDesc: string } }) => {
          expect(res.body.ResultCode).toBe(0);
          expect(res.body.ResultDesc).toBe('Accepted');
        });
    });
  });

  describe('POST /api/public/mpesa/stk-push/callback (STK Push)', () => {
    const validStkCallbackPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'e2e-test-' + Date.now(),
          CheckoutRequestID: 'ws_CO_E2E_' + Date.now(),
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: '100.00' },
              { Name: 'MpesaReceiptNumber', Value: 'E2EREC' + Date.now() },
              { Name: 'TransactionDate', Value: '20250127143045' },
              { Name: 'PhoneNumber', Value: '254722000000' },
            ],
          },
        },
      },
    };

    it('returns 200 and ResultCode 0 (Accepted)', () => {
      return request(app.getHttpServer())
        .post('/api/public/mpesa/stk-push/callback')
        .set('Content-Type', 'application/json')
        .send(validStkCallbackPayload)
        .expect([200, 201])
        .expect((res: { body: { ResultCode: number; ResultDesc: string } }) => {
          expect(res.body).toHaveProperty('ResultCode', 0);
          expect(res.body).toHaveProperty('ResultDesc', 'Accepted');
        });
    });

    it('returns 200 for cancelled/failed callback (non-zero ResultCode)', () => {
      return request(app.getHttpServer())
        .post('/api/public/mpesa/stk-push/callback')
        .set('Content-Type', 'application/json')
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'e2e-cancel-' + Date.now(),
              CheckoutRequestID: 'ws_CO_CANCEL_' + Date.now(),
              ResultCode: 1032,
              ResultDesc: 'Request cancelled by user',
            },
          },
        })
        .expect([200, 201])
        .expect((res: { body: { ResultCode: number; ResultDesc: string } }) => {
          expect(res.body.ResultCode).toBe(0);
          expect(res.body.ResultDesc).toBe('Accepted');
        });
    });
  });

  describe('IP whitelist guard', () => {
    it('allows request from localhost (development/test)', () => {
      return request(app.getHttpServer())
        .post('/api/public/mpesa/confirmation')
        .set('Content-Type', 'application/json')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({
          TransactionType: 'Pay Bill',
          TransID: 'E2E-IP-' + Date.now(),
          TransTime: '20250127143045',
          TransAmount: '1.00',
          BusinessShortCode: '174379',
          MSISDN: '254700000000',
        })
        .expect([200, 201])
        .expect((res: { body: { ResultCode: number } }) => {
          expect(res.body.ResultCode).toBe(0);
        });
    });
  });
});
