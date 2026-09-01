import { maskIdNumberForDisplay, maskIdNumberOrEmpty } from '../id-number-masking';

describe('maskIdNumberForDisplay', () => {
  it('returns null for empty values', () => {
    expect(maskIdNumberForDisplay(null)).toBeNull();
    expect(maskIdNumberForDisplay(undefined)).toBeNull();
    expect(maskIdNumberForDisplay('')).toBeNull();
    expect(maskIdNumberForDisplay('   ')).toBeNull();
  });

  it('masks a typical Kenyan national ID', () => {
    expect(maskIdNumberForDisplay('12345678')).toBe('12****78');
  });

  it('does not remask an already masked value', () => {
    expect(maskIdNumberForDisplay('12****78')).toBe('12****78');
  });

  it('masks short values entirely', () => {
    expect(maskIdNumberForDisplay('123')).toBe('***');
  });

  it('maskIdNumberOrEmpty returns empty string when missing', () => {
    expect(maskIdNumberOrEmpty(null)).toBe('');
    expect(maskIdNumberOrEmpty('12345678')).toBe('12****78');
  });
});
