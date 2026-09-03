import { occupyingPolicyPaymentAcSuffix, policySuffixLetterAt } from '../payment-ac-suffix.util';

describe('occupyingPolicyPaymentAcSuffix', () => {
  it('returns null for the first occupying policy', () => {
    expect(occupyingPolicyPaymentAcSuffix(0)).toBeNull();
  });

  it('uses B for the second occupying policy', () => {
    expect(occupyingPolicyPaymentAcSuffix(1)).toBe('B');
  });

  it('uses C for the third occupying policy', () => {
    expect(occupyingPolicyPaymentAcSuffix(2)).toBe('C');
  });
});

describe('policySuffixLetterAt', () => {
  it('skips A, I, J, and O', () => {
    expect(policySuffixLetterAt(0)).toBe('B');
    expect(POLICY_SKIPPED_LETTERS_NOT_USED());
  });
});

function POLICY_SKIPPED_LETTERS_NOT_USED(): void {
  const letters = Array.from({ length: 22 }, (_, i) => policySuffixLetterAt(i)).join('');
  expect(letters).toBe('BCDEFGHKLMNPQRSTUVWXYZ');
  expect(letters).not.toContain('A');
  expect(letters).not.toContain('I');
  expect(letters).not.toContain('J');
  expect(letters).not.toContain('O');
}
