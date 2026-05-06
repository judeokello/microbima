'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Deep-link login: Heritage-style card with masked-phone context (US2 / T027).
 */
export function DeepLinkLoginForm({
  greeting,
  maskedNational,
  initials,
  hasIdentity,
  phone,
  pin,
  loading,
  error,
  onPhoneChange,
  onPinChange,
  onSubmit,
  onGenericSignIn,
}: {
  greeting: string;
  maskedNational: string;
  initials: string;
  hasIdentity: boolean;
  phone: string;
  pin: string;
  loading: boolean;
  error: string | null;
  onPhoneChange: (value: string) => void;
  onPinChange: (value: string) => void;
  onSubmit: (e: import('react').FormEvent) => void;
  onGenericSignIn: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#ededf1] pb-6 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#e8e8ec] text-lg font-semibold text-[#480054]">
            {initials}
          </div>
          <div>
            <h1 className={`text-xl font-semibold text-[#480054]`}>{greeting}</h1>
            {maskedNational.length > 0 ? (
              <p className="text-sm text-[#4f434e]">{maskedNational}</p>
            ) : null}
          </div>
        </div>

        {!hasIdentity ? (
          <p className="mt-4 text-sm text-[#4f434e]">
            If this link is correct, enter the mobile number for your Maisha Poa membership and your registration
            code (OTP) from your SMS.
          </p>
        ) : (
          <p className="mt-4 text-sm text-[#4f434e]">
            Enter the mobile number for this membership and your registration code (OTP) from your SMS, or your PIN
            after setup.
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="deeplink-phone" className="text-sm font-medium text-[#4f434e]">
              Phone number
            </Label>
            <Input
              id="deeplink-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="07XXXXXXXX"
              value={phone}
              onChange={(ev) => onPhoneChange(ev.target.value)}
              className="rounded-xl border-0 bg-[#e2e2e6] px-4 py-3 text-[#1a1c1f] shadow-none focus-visible:ring-2 focus-visible:ring-[#480054]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deeplink-pin" className="text-sm font-medium text-[#4f434e]">
              PIN
            </Label>
            <Input
              id="deeplink-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="OTP from SMS or 6-digit PIN"
              value={pin}
              onChange={(ev) => onPinChange(ev.target.value)}
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
      </div>

      <p className="text-center text-sm text-[#4f434e]">
        Prefer the generic login?{' '}
        <button type="button" className="font-semibold text-[#480054] underline" onClick={onGenericSignIn}>
          Member sign in
        </button>
      </p>
    </div>
  );
}
