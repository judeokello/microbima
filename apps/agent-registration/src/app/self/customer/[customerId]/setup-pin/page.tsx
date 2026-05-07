'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, ROLES } from '@/lib/supabase';
import { fetchPortalSetupStatus } from '@/lib/customer-portal-api';
import { PinSetupForm } from '../../_components/pin-setup-form';

export default function SetupPinPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;
  const [state, setState] = useState<'checking' | 'ready' | 'redirect'>('checking');

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || session.user.id !== customerId) {
        router.replace(`/self/customer/${customerId}`);
        return;
      }

      const roles = (session.user.user_metadata as { roles?: string[] } | null)?.roles ?? [];
      if (!roles.includes(ROLES.CUSTOMER)) {
        router.replace('/self/customer');
        return;
      }

      try {
        const status = await fetchPortalSetupStatus(session.access_token);
        if (status.portalPinSetupCompleted) {
          router.replace(`/self/customer/${customerId}/products`);
          setState('redirect');
          return;
        }
        setState('ready');
      } catch {
        router.replace(`/self/customer/${customerId}`);
      }
    })();
  }, [customerId, router]);

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-[#f9f9fd]">
      <header className="border-b border-transparent bg-[#f3f3f7]/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-center">
          <span className="text-lg font-semibold tracking-tight text-[#480054] font-[family-name:var(--font-portal-display)]">
            MaishaPoa
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{content}</main>
      <footer className="mx-auto max-w-lg px-4 pb-8 text-center text-sm text-[#4f434e]">
        <p>Need help? Contact support using the numbers in your welcome message.</p>
      </footer>
    </div>
  );

  if (state !== 'ready') {
    return shell(
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-[#4f434e]">Loading…</p>
      </div>,
    );
  }

  return shell(<PinSetupForm customerId={customerId} />);
}
