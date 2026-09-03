/// <reference types="jest" />
import { AdditionalPolicyService } from '../additional-policy.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { ErrorCodes } from '../../enums/error-codes.enum';
import { CustomerStatus, PolicyStatus } from '@prisma/client';

describe('AdditionalPolicyService', () => {
  const policyService = {
    loadEnrolmentSnapshots: jest.fn(),
    createPolicyWithoutPayments: jest.fn(),
  };
  const mpesa = { initiateStkPush: jest.fn() };
  const packagePricing = { getPricing: jest.fn() };
  const prisma = {
    customer: { findUnique: jest.fn(), findFirst: jest.fn() },
  };

  const service = new AdditionalPolicyService(
    prisma as never,
    policyService as never,
    mpesa as never,
    packagePricing as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks non-admins with insufficient permissions', async () => {
    await expect(service.getEligibility('cust-1', 'user-1', ['brand_ambassador'])).rejects.toBeInstanceOf(
      ValidationException
    );
    try {
      await service.getEligibility('cust-1', 'user-1', ['brand_ambassador']);
    } catch (err) {
      expect((err as ValidationException).errorCode).toBe(ErrorCodes.INSUFFICIENT_PERMISSIONS);
    }
  });

  it('blocks terminated customers', async () => {
    policyService.loadEnrolmentSnapshots.mockResolvedValue({
      customerStatus: CustomerStatus.TERMINATED,
      snapshots: [],
    });
    const result = await service.getEligibility('cust-1', 'user-1', ['registration_admin']);
    expect(result.canAdd).toBe(false);
    expect(result.blockedReasons.some((r) => r.toLowerCase().includes('terminated'))).toBe(true);
  });

  it('blocks when an occupying postpaid policy exists', async () => {
    policyService.loadEnrolmentSnapshots.mockResolvedValue({
      customerStatus: CustomerStatus.ACTIVE,
      snapshots: [
        { id: 'p1', packageId: 1, status: PolicyStatus.ACTIVE, isPostpaid: true },
      ],
    });
    const result = await service.getEligibility('cust-1', 'user-1', ['registration_admin']);
    expect(result.canAdd).toBe(false);
    expect(result.blockedReasons.some((r) => r.toLowerCase().includes('postpaid'))).toBe(true);
  });
});
