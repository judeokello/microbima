import { international254ToNational07 } from '../../utils/customer-portal-auth.util';

export type NonProdMessagingTag = 'dev' | 'stg';

/**
 * Returns a short env tag for non-prod messaging prefixes, or null in production / other envs.
 */
export function getNonProdMessagingTag(nodeEnv: string | undefined | null): NonProdMessagingTag | null {
  if (nodeEnv === 'development') return 'dev';
  if (nodeEnv === 'staging') return 'stg';
  return null;
}

/**
 * Build inbox prefix like `[dev, 0722123456]` from env tag + stored customer phone (254…).
 */
export function buildNonProdMessagingPrefix(tag: NonProdMessagingTag, customerPhoneStored: string): string {
  const national = international254ToNational07(customerPhoneStored);
  return `[${tag}, ${national}]`;
}

/**
 * Apply non-prod prefix to SMS body or email subject when a customer-linked delivery is rendered.
 * Unmatched / phone-only deliveries (no customer) are left unchanged.
 */
export function applyNonProdMessagingPrefix(params: {
  nodeEnv: string | undefined | null;
  customerPhone: string | null | undefined;
  channel: 'SMS' | 'EMAIL';
  renderedBody: string;
  renderedSubject: string | null;
}): { renderedBody: string; renderedSubject: string | null } {
  const tag = getNonProdMessagingTag(params.nodeEnv);
  if (!tag || !params.customerPhone?.trim()) {
    return { renderedBody: params.renderedBody, renderedSubject: params.renderedSubject };
  }

  let prefix: string;
  try {
    prefix = buildNonProdMessagingPrefix(tag, params.customerPhone);
  } catch {
    return { renderedBody: params.renderedBody, renderedSubject: params.renderedSubject };
  }

  if (params.channel === 'SMS') {
    return {
      renderedBody: `${prefix} ${params.renderedBody}`,
      renderedSubject: params.renderedSubject,
    };
  }

  // EMAIL: prefix subject only
  const subject = params.renderedSubject?.trim()
    ? `${prefix} ${params.renderedSubject}`
    : prefix;
  return {
    renderedBody: params.renderedBody,
    renderedSubject: subject,
  };
}
