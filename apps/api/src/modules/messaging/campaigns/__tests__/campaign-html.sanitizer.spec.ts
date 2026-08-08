import {
  sanitizeCampaignHtml,
  stripHtmlToPlainText,
} from '../campaign-html.sanitizer';

describe('campaign-html.sanitizer', () => {
  it('strips script tags and content', () => {
    const input = '<p>Hello</p><script>alert(1)</script><p>World</p>';
    const out = sanitizeCampaignHtml(input);
    expect(out).toContain('Hello');
    expect(out).toContain('World');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips event-handler attributes', () => {
    const input = '<p onclick="evil()">Click</p><a href="https://example.com" onmouseover="x()">link</a>';
    const out = sanitizeCampaignHtml(input);
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out.toLowerCase()).not.toContain('onmouseover');
    expect(out).toContain('Click');
  });

  it('allows basic rich-text tags used by TipTap', () => {
    const input =
      '<p>Hi <strong>Jane</strong></p><ul><li>one</li></ul><a href="https://example.com">site</a>';
    const out = sanitizeCampaignHtml(input);
    expect(out).toContain('<strong>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>');
    expect(out).toContain('href="https://example.com"');
  });

  it('strips javascript: URLs', () => {
    const out = sanitizeCampaignHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('stripHtmlToPlainText returns empty for empty rich-text chrome (FR-009a)', () => {
    expect(stripHtmlToPlainText('<p></p>').trim().length).toBe(0);
    expect(stripHtmlToPlainText('<p><br></p>').trim().length).toBe(0);
    expect(stripHtmlToPlainText('<p>&nbsp;</p>').trim().length).toBe(0);
    expect(stripHtmlToPlainText('<p>Hi</p>').trim()).toBe('Hi');
  });
});
