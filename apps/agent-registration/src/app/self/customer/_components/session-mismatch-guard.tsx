'use client';

import { type ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';

/**
 * If a session exists but `sub` ≠ route `customerId`, sign out and send the member to generic login (no return URL).
 */
export function SessionMismatchGuard({
  customerId,
  children,
}: {
  customerId: string;
  children: ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled || !session?.user?.id) return;

      if (session.user.id !== customerId) {
        await supabase.auth.signOut();
        router.replace('/self/customer');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, router]);

  return <>{children}</>;
}
