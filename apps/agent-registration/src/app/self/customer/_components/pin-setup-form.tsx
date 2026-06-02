'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { completePortalPinSetup } from '@/lib/customer-portal-api';
import {
  WEAK_PORTAL_PIN_MESSAGE,
  isEasilyGuessablePortalPin,
} from '@microbima/portal-pin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PinSetupForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(pin) || !/^\d{6}$/.test(pinConfirm)) {
      setError('PIN and confirmation must each be exactly 6 digits.');
      return;
    }

    if (isEasilyGuessablePortalPin(pin)) {
      setError(WEAK_PORTAL_PIN_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || session.user.id !== customerId) {
        setError('Your session expired. Please sign in again.');
        router.replace(`/self/customer/${customerId}`);
        return;
      }

      await completePortalPinSetup(session.access_token, pin, pinConfirm);
      await supabase.auth.refreshSession();
      router.replace(`/self/customer/${customerId}/products`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete PIN setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#631c6e]">Step 2 of 2</p>
      <h1 className="mt-2 text-xl font-semibold text-[#480054]">Secure your account</h1>
      <p className="mt-3 text-sm text-[#4f434e]">
        Choose a 6-digit PIN you will use instead of the SMS code from here on. Pick something memorable but not obvious
        — avoid repeating digits such as <span className="whitespace-nowrap">111111</span>, or simple sequences
        like <span className="whitespace-nowrap">123456</span>.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="new-pin" className="text-sm font-medium text-[#4f434e]">
            New 6-digit PIN
          </Label>
          <Input
            id="new-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            pattern="\d{6}"
            value={pin}
            onChange={(ev) => setPin(ev.target.value.replace(/\D/g, '').slice(0, 6))}
            className="rounded-xl border-0 bg-[#e2e2e6] px-4 py-3 text-lg tracking-widest text-[#1a1c1f] shadow-none focus-visible:ring-2 focus-visible:ring-[#480054]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-pin" className="text-sm font-medium text-[#4f434e]">
            Confirm PIN
          </Label>
          <Input
            id="confirm-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            pattern="\d{6}"
            value={pinConfirm}
            onChange={(ev) => setPinConfirm(ev.target.value.replace(/\D/g, '').slice(0, 6))}
            className="rounded-xl border-0 bg-[#e2e2e6] px-4 py-3 text-lg tracking-widest text-[#1a1c1f] shadow-none focus-visible:ring-2 focus-visible:ring-[#480054]"
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-[#480054] to-[#631c6e] py-6 text-base font-semibold text-white shadow-md hover:opacity-95"
        >
          {loading ? 'Saving…' : 'Complete setup'}
        </Button>
      </form>
    </div>
  );
}
