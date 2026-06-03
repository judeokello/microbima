'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export function PortalMemberHome({ customerId: memberCustomerId }: { customerId: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm" data-customer-id={memberCustomerId}>
      <h1 className="text-xl font-semibold text-[#480054]">Your Maisha Poa portal</h1>
      <p className="mt-3 text-sm text-[#4f434e]">
        Signed in securely. Policies and payments for your cover will appear here as we finish rollout.
      </p>
      <Button
        variant="outline"
        className="mt-6 rounded-xl border-[#81737f]/30"
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.assign('/self/customer');
        }}
      >
        Sign out
      </Button>
      <p className="mt-6 text-xs text-[#4f434e]">
        Wrong account?{' '}
        <Link href="/self/customer" className="font-medium text-[#480054] underline">
          Generic member sign in
        </Link>
      </p>
    </div>
  );
}
