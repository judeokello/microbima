/// <reference types="jest" />
import { PolicyService } from '../policy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentAccountNumberService } from '../payment-account-number.service';

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

  const policyService = new PolicyService(
    prismaMock as unknown as PrismaService,
    paymentAccountNumberServiceMock as unknown as PaymentAccountNumberService
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

    const firstPolicyNumber = await (policyService as unknown as { generatePolicyNumber: (packageId: number, correlationId: string) => Promise<string> }).generatePolicyNumber(1, 'corr-1');
    const secondPolicyNumber = await (policyService as unknown as { generatePolicyNumber: (packageId: number, correlationId: string) => Promise<string> }).generatePolicyNumber(1, 'corr-2');

    expect(firstPolicyNumber).toBe('MP/MFG/001');
    expect(secondPolicyNumber).toBe('MP/MFG/002');
  });
});

