'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, ROLES } from '@/lib/supabase';
import { nationalPhoneToSyntheticEmail } from '@/lib/customer-portal-auth';
import { formatPhoneNumber } from '@/lib/phone-validation';
import { fetchPortalSetupStatus } from '@/lib/customer-portal-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function GenericLoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const digits = formatPhoneNumber(phone);
      const email = nationalPhoneToSyntheticEmail(digits);
      const { data, error: signError } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (signError) {
        setError(signError.message === 'Invalid login credentials' ? 'Invalid phone number or PIN' : signError.message);
        return;
      }

      if (!data.session?.user) {
        setError('Sign-in failed. Please try again.');
        return;
      }

      const roles = (data.session.user.user_metadata as { roles?: string[] } | null)?.roles ?? [];
      if (!roles.includes(ROLES.CUSTOMER)) {
        await supabase.auth.signOut();
        setError('This portal is for members only.');
        return;
      }

      const customerId = data.session.user.id;
      const status = await fetchPortalSetupStatus(data.session.access_token);

      if (!status.portalPinSetupCompleted) {
        router.replace(`/self/customer/${customerId}/setup-pin`);
      } else {
        router.replace(`/self/customer/${customerId}/products`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="portal-phone" className="text-sm font-medium text-[#4f434e]">
          Phone number
        </Label>
        <Input
          id="portal-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="07XXXXXXXX"
          value={phone}
          onChange={(ev) => setPhone(ev.target.value)}
          className="rounded-xl border-0 bg-[#e2e2e6] px-4 py-3 text-[#1a1c1f] shadow-none focus-visible:ring-2 focus-visible:ring-[#480054]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="portal-pin" className="text-sm font-medium text-[#4f434e]">
          PIN
        </Label>
        <p className="text-xs text-[#4f434e]">
          Use the registration code (OTP) from your welcome SMS the first time you sign in, then your 6-digit PIN
          after you complete setup.
        </p>
        <Input
          id="portal-pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="Enter OTP or PIN"
          value={pin}
          onChange={(ev) => setPin(ev.target.value)}
          className="rounded-xl border-0 bg-[#e2e2e6] px-4 py-3 text-[#1a1c1f] shadow-none focus-visible:ring-2 focus-visible:ring-[#480054]"
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-[#480054] to-[#631c6e] py-6 text-base font-semibold text-white shadow-md hover:opacity-95"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
