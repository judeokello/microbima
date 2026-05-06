'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase, ROLES } from '@/lib/supabase';
import { fetchPortalSetupStatus } from '@/lib/customer-portal-api';

/**
 * Authenticated portal shell for /self/customer/:customerId/(portal)/**.
 *
 * Responsibilities:
 * - Verify session exists + sub === customerId (tamper → sign out → generic login, no return URL).
 * - Verify PIN setup is complete (else redirect to setup-pin).
 * - Render Heritage top-bar with Products link + sign-out.
 */
export default function PortalAuthenticatedLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user?.id) {
        router.replace('/self/customer');
        return;
      }

      if (session.user.id !== customerId) {
        await supabase.auth.signOut();
        router.replace('/self/customer');
        return;
      }

      const roles = (session.user.user_metadata as { roles?: string[] } | null)?.roles ?? [];
      if (!roles.includes(ROLES.CUSTOMER)) {
        await supabase.auth.signOut();
        router.replace('/self/customer');
        return;
      }

      try {
        const status = await fetchPortalSetupStatus(session.access_token);
        if (!status.portalPinSetupCompleted) {
          router.replace(`/self/customer/${customerId}/setup-pin`);
          return;
        }
      } catch {
        router.replace('/self/customer');
        return;
      }

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/self/customer');
  };

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-[#4f434e]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9fd]">
      {/* Heritage authenticated top-bar */}
      <nav className="sticky top-0 z-40 border-b border-[#d2c2cf]/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link
              href={`/self/customer/${customerId}/products`}
              className="text-base font-semibold tracking-tight text-[#480054] font-[family-name:var(--font-portal-display)]"
            >
              MaishaPoa
            </Link>
            <Link
              href={`/self/customer/${customerId}/products`}
              className="text-sm text-[#4f434e] hover:text-[#480054] transition-colors"
            >
              My Products
            </Link>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="text-sm font-medium text-[#480054] hover:underline"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>

      <footer className="mx-auto max-w-4xl px-4 pb-8 text-center text-sm text-[#4f434e]">
        <p>Need help? Contact support using the numbers in your welcome message.</p>
      </footer>
    </div>
  );
}
