/// <reference types="jest" />
import { PolicyService } from '../policy.service';

describe('PolicyService - generatePolicyNumber', () => {
  const prismaMock = {
    package: {
      findUnique: jest.fn(),
    },
    policy: {
      findFirst: jest.fn(),
    },
  };

  const policyService = new PolicyService(prismaMock as any);

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

    const firstPolicyNumber = await (policyService as any).generatePolicyNumber(1, 'corr-1');
    const secondPolicyNumber = await (policyService as any).generatePolicyNumber(1, 'corr-2');

    expect(firstPolicyNumber).toBe('MP/MFG/001');
    expect(secondPolicyNumber).toBe('MP/MFG/002');
  });
});

