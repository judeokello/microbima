import type { ReactNode } from 'react';

import { SessionMismatchGuard } from '../_components/session-mismatch-guard';

/**
 * Shell for unauthenticated /self/customer/:customerId pages (login, setup-pin).
 * - Enforces session sub === customerId (tamper → sign out → generic login).
 * - Provides Heritage header + footer for login and setup-pin screens.
 * - The (portal) route group has its own layout that supersedes this shell
 *   for authenticated product pages.
 */
export default async function CustomerPortalIdLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  return (
    <SessionMismatchGuard customerId={customerId}>
      <div className="min-h-screen bg-[#f9f9fd]">
        <header className="border-b border-transparent bg-[#f3f3f7]/80 px-4 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center justify-center">
            <span className="text-lg font-semibold tracking-tight text-[#480054] font-[family-name:var(--font-portal-display)]">
              MaishaPoa
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-lg px-4 pb-8 text-center text-sm text-[#4f434e]">
          <p>Need help? Contact support using the numbers in your welcome message.</p>
        </footer>
      </div>
    </SessionMismatchGuard>
  );
}
