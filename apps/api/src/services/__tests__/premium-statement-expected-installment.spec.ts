/// <reference types="jest" />
import { NotFoundException } from '@nestjs/common';
import { PremiumStatementService } from '../premium-statement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidationException } from '../../exceptions/validation.exception';

jest.mock('@sentry/nestjs', () => ({
  captureMessage: jest.fn(),
}));

describe('PremiumStatementService - expectedInstallmentCount gate', () => {
  const prismaMock = {
    policy: {
      findFirst: jest.fn(),
    },
    packageSchemeCustomer: {
      findFirst: jest.fn(),
    },
    policyPayment: {
      findMany: jest.fn(),
    },
  };

  const service = new PremiumStatementService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.packageSchemeCustomer.findFirst.mockResolvedValue({
      packageScheme: { scheme: { isPostpaid: false } },
    });
  });

  it('blocks when expectedInstallmentCount is missing', async () => {
    prismaMock.policy.findFirst.mockResolvedValue({
      id: 'pol-1',
      packageId: 1,
      policyNumber: 'MP/MFG/001',
      startDate: new Date('2025-01-01T00:00:00Z'),
      premium: 100,
      paymentCadence: 1,
      expectedInstallmentCount: null,
      productName: 'MfanisiGo Gold',
      customer: { firstName: 'Jane', middleName: null, lastName: 'Doe' },
      package: { name: 'MfanisiGo', totalPremium: 27600 },
      packagePlan: { name: 'Gold' },
    });

    await expect(
      service.generatePremiumStatementPdf({
        customerId: 'cust-1',
        policyId: 'pol-1',
        correlationId: 'corr-1',
      })
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('blocks when expectedInstallmentCount is zero', async () => {
    prismaMock.policy.findFirst.mockResolvedValue({
      id: 'pol-1',
      packageId: 1,
      policyNumber: 'MP/MFG/001',
      startDate: new Date('2025-01-01T00:00:00Z'),
      premium: 100,
      paymentCadence: 1,
      expectedInstallmentCount: 0,
      productName: 'MfanisiGo Gold',
      customer: { firstName: 'Jane', middleName: null, lastName: 'Doe' },
      package: { name: 'MfanisiGo', totalPremium: 27600 },
      packagePlan: { name: 'Gold' },
    });

    await expect(
      service.generatePremiumStatementPdf({
        customerId: 'cust-1',
        policyId: 'pol-1',
        correlationId: 'corr-1',
      })
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('blocks when policy number is missing (still enforced)', async () => {
    prismaMock.policy.findFirst.mockResolvedValue({
      id: 'pol-1',
      packageId: 1,
      policyNumber: null,
      startDate: new Date('2025-01-01T00:00:00Z'),
      premium: 100,
      paymentCadence: 1,
      expectedInstallmentCount: 276,
      productName: 'MfanisiGo Gold',
      customer: { firstName: 'Jane', middleName: null, lastName: 'Doe' },
      package: { name: 'MfanisiGo', totalPremium: 27600 },
      packagePlan: { name: 'Gold' },
    });

    await expect(
      service.generatePremiumStatementPdf({
        customerId: 'cust-1',
        policyId: 'pol-1',
        correlationId: 'corr-1',
      })
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('throws NotFound when policy does not belong to customer', async () => {
    prismaMock.policy.findFirst.mockResolvedValue(null);

    await expect(
      service.generatePremiumStatementPdf({
        customerId: 'cust-1',
        policyId: 'pol-missing',
        correlationId: 'corr-1',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
