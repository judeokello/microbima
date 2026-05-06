'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, ROLES } from '@/lib/supabase';
import { fetchPortalSetupStatus } from '@/lib/customer-portal-api';
import { GenericLoginForm } from './generic-login-form';

export function SelfServiceHomeClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setReady(true);
        return;
      }

      const roles = (session.user.user_metadata as { roles?: string[] } | null)?.roles ?? [];
      if (!roles.includes(ROLES.CUSTOMER)) {
        setReady(true);
        return;
      }

      try {
        const status = await fetchPortalSetupStatus(session.access_token);
        if (!status.portalPinSetupCompleted) {
          router.replace(`/self/customer/${session.user.id}/setup-pin`);
          return;
        }
        router.replace(`/self/customer/${session.user.id}/products`);
      } catch {
        setReady(true);
      }
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-[#4f434e]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="font-[family-name:var(--font-portal-display)] text-xl font-semibold text-[#480054]">
        Member sign in
      </h1>
      <p className="mt-2 text-sm text-[#4f434e]">
        Sign in with your mobile number and the code from your welcome SMS, or your PIN after you have completed
        setup.
      </p>
      <div className="mt-8">
        <GenericLoginForm />
      </div>
    </div>
  );
}
