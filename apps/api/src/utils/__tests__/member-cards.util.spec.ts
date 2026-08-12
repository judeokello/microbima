/// <reference types="jest" />
import { PolicyStatus } from '@prisma/client';
import { policyHasMemberCards } from '../member-cards.util';

describe('member-cards.util', () => {
  describe('policyHasMemberCards', () => {
    it('is false while the policy is pending activation', () => {
      expect(
        policyHasMemberCards({
          status: PolicyStatus.PENDING_ACTIVATION,
          principalMemberNumber: 'MB-001',
        })
      ).toBe(false);
      expect(
        policyHasMemberCards({
          status: 'PENDING_ACTIVATION',
          principalMemberNumber: null,
        })
      ).toBe(false);
    });

    it('is false when the principal has no member number yet', () => {
      expect(
        policyHasMemberCards({
          status: PolicyStatus.ACTIVE,
          principalMemberNumber: null,
        })
      ).toBe(false);
      expect(
        policyHasMemberCards({
          status: PolicyStatus.ACTIVE,
          principalMemberNumber: '   ',
        })
      ).toBe(false);
    });

    it('is true for activated policies with a principal member number', () => {
      expect(
        policyHasMemberCards({
          status: PolicyStatus.ACTIVE,
          principalMemberNumber: 'MB-001-00',
        })
      ).toBe(true);
      expect(
        policyHasMemberCards({
          status: PolicyStatus.SUSPENDED,
          principalMemberNumber: 'MB-001-00',
        })
      ).toBe(true);
    });
  });
});
