/// <reference types="jest" />
import { schemeSearchQueryReady } from '../src/lib/scheme-search';

describe('schemeSearchQueryReady', () => {
  it('requires at least two letters before searching', () => {
    expect(schemeSearchQueryReady('')).toBe(false);
    expect(schemeSearchQueryReady('M')).toBe(false);
    expect(schemeSearchQueryReady('  m ')).toBe(false);
    expect(schemeSearchQueryReady('Ma')).toBe(true);
    expect(schemeSearchQueryReady('Mfanisi')).toBe(true);
  });
});
