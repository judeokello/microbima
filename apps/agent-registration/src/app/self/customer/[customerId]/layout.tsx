import type { ReactNode } from 'react';

import { SessionMismatchGuard } from '../_components/session-mismatch-guard';

/**
 * Enforces session `sub` === route customerId (tamper → sign out → generic login).
 */
export default async function CustomerPortalIdLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  return <SessionMismatchGuard customerId={customerId}>{children}</SessionMismatchGuard>;
}
