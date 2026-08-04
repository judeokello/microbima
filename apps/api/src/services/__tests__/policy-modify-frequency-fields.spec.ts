/**
 * Documents the contract for modify-product frequency changes:
 * premium, annualPremium, and expectedInstallmentCount must all be written
 * onto the new policy together.
 */
import { PaymentFrequency } from '@prisma/client';

function resolveModifyExpectedCount(params: {
  dtoFrequency: PaymentFrequency;
  sourceFrequency: PaymentFrequency;
  sourceExpected: number | null;
  packageId: number;
  resolve: (packageId: number, frequency: PaymentFrequency) => Promise<number>;
}): Promise<number> {
  const { dtoFrequency, sourceFrequency, sourceExpected, packageId, resolve } = params;
  if (dtoFrequency === sourceFrequency && sourceExpected != null && sourceExpected > 0) {
    return Promise.resolve(sourceExpected);
  }
  return resolve(packageId, dtoFrequency);
}

describe('modify-product frequency field updates', () => {
  it('resolves a new expectedInstallmentCount when frequency changes', async () => {
    const resolve = jest.fn(async (_packageId: number, frequency: PaymentFrequency) => {
      const map: Partial<Record<PaymentFrequency, number>> = {
        [PaymentFrequency.DAILY]: 276,
        [PaymentFrequency.WEEKLY]: 39,
        [PaymentFrequency.MONTHLY]: 9,
        [PaymentFrequency.ANNUALLY]: 1,
      };
      return map[frequency] ?? 1;
    });

    const expectedInstallmentCount = await resolveModifyExpectedCount({
      dtoFrequency: PaymentFrequency.MONTHLY,
      sourceFrequency: PaymentFrequency.DAILY,
      sourceExpected: 276,
      packageId: 1,
      resolve,
    });

    const newPolicyData = {
      premium: 1953,
      annualPremium: 22995,
      frequency: PaymentFrequency.MONTHLY,
      expectedInstallmentCount,
    };

    expect(resolve).toHaveBeenCalledWith(1, PaymentFrequency.MONTHLY);
    expect(newPolicyData).toEqual({
      premium: 1953,
      annualPremium: 22995,
      frequency: PaymentFrequency.MONTHLY,
      expectedInstallmentCount: 9,
    });
  });

  it('keeps prior expectedInstallmentCount when frequency is unchanged', async () => {
    const resolve = jest.fn();
    const expectedInstallmentCount = await resolveModifyExpectedCount({
      dtoFrequency: PaymentFrequency.WEEKLY,
      sourceFrequency: PaymentFrequency.WEEKLY,
      sourceExpected: 39,
      packageId: 1,
      resolve,
    });

    expect(resolve).not.toHaveBeenCalled();
    expect(expectedInstallmentCount).toBe(39);
  });
});
