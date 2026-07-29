import {
  applyNonProdMessagingPrefix,
  buildNonProdMessagingPrefix,
  getNonProdMessagingTag,
} from '../non-prod-messaging.util';

describe('non-prod-messaging.util', () => {
  describe('getNonProdMessagingTag', () => {
    it('maps development to dev', () => {
      expect(getNonProdMessagingTag('development')).toBe('dev');
    });

    it('maps staging to stg', () => {
      expect(getNonProdMessagingTag('staging')).toBe('stg');
    });

    it('returns null for production and unknown', () => {
      expect(getNonProdMessagingTag('production')).toBeNull();
      expect(getNonProdMessagingTag('test')).toBeNull();
      expect(getNonProdMessagingTag(undefined)).toBeNull();
    });
  });

  describe('buildNonProdMessagingPrefix', () => {
    it('formats national 07 phone', () => {
      expect(buildNonProdMessagingPrefix('dev', '254722123456')).toBe('[dev, 0722123456]');
      expect(buildNonProdMessagingPrefix('stg', '254112123456')).toBe('[stg, 0112123456]');
    });
  });

  describe('applyNonProdMessagingPrefix', () => {
    it('prefixes SMS body in development', () => {
      const result = applyNonProdMessagingPrefix({
        nodeEnv: 'development',
        customerPhone: '254722123456',
        channel: 'SMS',
        renderedBody: 'Hello Jane',
        renderedSubject: null,
      });
      expect(result.renderedBody).toBe('[dev, 0722123456] Hello Jane');
      expect(result.renderedSubject).toBeNull();
    });

    it('prefixes email subject only in staging', () => {
      const result = applyNonProdMessagingPrefix({
        nodeEnv: 'staging',
        customerPhone: '254722123456',
        channel: 'EMAIL',
        renderedBody: '<p>Hello</p>',
        renderedSubject: 'Welcome',
      });
      expect(result.renderedBody).toBe('<p>Hello</p>');
      expect(result.renderedSubject).toBe('[stg, 0722123456] Welcome');
    });

    it('leaves unmatched / no-customer deliveries unchanged', () => {
      const result = applyNonProdMessagingPrefix({
        nodeEnv: 'development',
        customerPhone: null,
        channel: 'SMS',
        renderedBody: 'Unmatched payment',
        renderedSubject: null,
      });
      expect(result.renderedBody).toBe('Unmatched payment');
    });

    it('does not prefix in production', () => {
      const result = applyNonProdMessagingPrefix({
        nodeEnv: 'production',
        customerPhone: '254722123456',
        channel: 'SMS',
        renderedBody: 'Hello',
        renderedSubject: null,
      });
      expect(result.renderedBody).toBe('Hello');
    });
  });
});
