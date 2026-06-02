'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, ROLES } from '@/lib/supabase';
import { nationalPhoneToSyntheticEmail } from '@/lib/customer-portal-auth';
import { formatPhoneNumber } from '@/lib/phone-validation';
import { fetchPortalSetupStatus, type LoginDisplayContext } from '@/lib/customer-portal-api';
import { DeepLinkLoginForm } from './deep-link-login-form';
import { PortalMemberHome } from './portal-member-home';

type Props = {
  customerId: string;
  initialContext: LoginDisplayContext | null;
};

export function CustomerDeepLinkPage({ customerId, initialContext }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionView, setSessionView] = useState<'checking' | 'guest' | 'authed'>('checking');

  const first = initialContext?.firstName?.trim() ?? '';
  const last = initialContext?.lastName?.trim() ?? '';
  const masked = initialContext?.maskedPhoneNational?.trim() ?? '';
  const hasIdentity = first.length > 0 || last.length > 0 || masked.length > 0;
  const greeting = first.length > 0 ? `Hi ${first}${last.length > 0 ? ` ${last}` : ''}` : 'Member sign in';

  useEffect(() => {
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id || session.user.id !== customerId) {
          setSessionView('guest');
          return;
        }

        const roles = (session.user.user_metadata as { roles?: string[] } | null)?.roles ?? [];
        if (!roles.includes(ROLES.CUSTOMER)) {
          setSessionView('guest');
          return;
        }

        const status = await fetchPortalSetupStatus(session.access_token);
        if (!status.portalPinSetupCompleted) {
          router.replace(`/self/customer/${customerId}/setup-pin`);
          return;
        }
        router.replace(`/self/customer/${customerId}/products`);
      } catch {
        setSessionView('guest');
      }
    })();
  }, [customerId, router]);

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

      if (data.session.user.id !== customerId) {
        await supabase.auth.signOut();
        setError('This phone number does not match this sign-in link. Use the generic sign-in page or open the correct SMS link.');
        return;
      }

      const roles = (data.session.user.user_metadata as { roles?: string[] } | null)?.roles ?? [];
      if (!roles.includes(ROLES.CUSTOMER)) {
        await supabase.auth.signOut();
        setError('This portal is for members only.');
        return;
      }

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

  if (sessionView === 'checking') {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-[#4f434e]">Loading…</p>
      </div>
    );
  }

  if (sessionView === 'authed') {
    return <PortalMemberHome customerId={customerId} />;
  }

  const initials = first.length > 0 ? first.slice(0, 1).toUpperCase() : '?';

  return (
    <DeepLinkLoginForm
      greeting={greeting}
      maskedNational={masked}
      initials={initials}
      hasIdentity={hasIdentity}
      phone={phone}
      pin={pin}
      loading={loading}
      error={error}
      onPhoneChange={setPhone}
      onPinChange={setPin}
      onSubmit={onSubmit}
      onGenericSignIn={() => router.push('/self/customer')}
    />
  );
}
