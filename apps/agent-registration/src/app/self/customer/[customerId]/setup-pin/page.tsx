'use client';

import { useEffect, useState } from 'react';
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

  if (state !== 'ready') {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-[#4f434e]">Loading…</p>
      </div>
    );
  }

  return <PinSetupForm customerId={customerId} />;
}
