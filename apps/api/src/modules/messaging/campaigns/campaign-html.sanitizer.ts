// CJS require: sanitize-html → htmlparser2 ESM breaks Jest ESM parse of `import`
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html') as typeof import('sanitize-html');

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'span',
  'div',
];

/**
 * Sanitize admin campaign email HTML (FR-010a).
 * Strips scripts/handlers; allows TipTap-style rich-text tags.
 */
export function sanitizeCampaignHtml(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      span: ['style'],
      p: ['style'],
      div: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}

/** Strip tags/entities for empty-body checks (FR-009a). */
export function stripHtmlToPlainText(html: string): string {
  if (!html) return '';
  const withoutTags = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return withoutTags
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}
