/// <reference types="jest" />
import { AdditionalPolicyService } from '../additional-policy.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { ErrorCodes } from '../../enums/error-codes.enum';

describe('AdditionalPolicyService authorization and eligibility', () => {
  const prisma = {
    customer: { findUnique: jest.fn() },
  };
  const policyService = {};
  const service = new AdditionalPolicyService(prisma as never, policyService as never);

  it('rejects non-admin roles', () => {
    expect(() => service.assertRegistrationAdmin(['brand_ambassador'])).toThrow(
      ValidationException
    );
    try {
      service.assertRegistrationAdmin(['brand_ambassador']);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationException);
      expect((error as ValidationException).errorCode).toBe(ErrorCodes.INSUFFICIENT_PERMISSIONS);
    }
  });

  it('allows registration_admin', () => {
    expect(() => service.assertRegistrationAdmin(['registration_admin'])).not.toThrow();
  });

  it('blocks terminated customers', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'TERMINATED',
      createdByPartnerId: 1,
      dependants: [],
      beneficiaries: [],
      policies: [{ id: 'p1', status: 'EXPIRED' }],
    });

    await expect(
      service.createAdditionalPolicy(
        'c1',
        {
          packageSchemeId: 1,
          packagePlanId: 1,
          frequency: 'MONTHLY',
          premium: 100,
          productName: 'Test',
          beneficiaryId: 'b1',
        } as never,
        ['registration_admin'],
        'corr'
      )
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('blocks when any policy is TERMINATED', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
      createdByPartnerId: 1,
      dependants: [],
      beneficiaries: [],
      policies: [{ id: 'p1', status: 'TERMINATED' }],
    });

    await expect(
      service.createAdditionalPolicy(
        'c1',
        {
          packageSchemeId: 1,
          packagePlanId: 1,
          frequency: 'MONTHLY',
          premium: 100,
          productName: 'Test',
          beneficiaryId: 'b1',
        } as never,
        ['registration_admin'],
        'corr'
      )
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
