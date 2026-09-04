import { copyPolicyBeneficiaryJoins } from '../copy-policy-beneficiary.util';

describe('copyPolicyBeneficiaryJoins', () => {
  it('copies the source policy NOK onto the new policy', async () => {
    const upsert = jest.fn();
    const tx = {
      policyBeneficiary: {
        findMany: jest.fn().mockResolvedValue([
          { policyId: 'old', beneficiaryId: 'ben-1', percentage: 100 },
        ]),
        upsert,
      },
    };

    await copyPolicyBeneficiaryJoins(tx as never, 'old', 'new');

    expect(tx.policyBeneficiary.findMany).toHaveBeenCalledWith({ where: { policyId: 'old' } });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyId: 'new' },
        create: expect.objectContaining({
          policyId: 'new',
          beneficiaryId: 'ben-1',
          percentage: 100,
        }),
      })
    );
  });

  it('is a no-op when the source policy has no join row', async () => {
    const upsert = jest.fn();
    const tx = {
      policyBeneficiary: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert,
      },
    };
    await copyPolicyBeneficiaryJoins(tx as never, 'old', 'new');
    expect(upsert).not.toHaveBeenCalled();
  });
});
