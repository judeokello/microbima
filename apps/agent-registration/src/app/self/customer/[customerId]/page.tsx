import { CustomerDeepLinkPage } from '../_components/customer-deep-link-page';
import { fetchLoginDisplayContext } from '@/lib/customer-portal-api';

export const dynamic = 'force-dynamic';

/**
 * SMS deep link: `/self/customer/:customerId` — sign-in → PIN setup → member home (US2 + partial US5 shell).
 */
export default async function CustomerSelfServiceDeepLinkPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const ctx = await fetchLoginDisplayContext(customerId);
  return (
    <div className="min-h-screen bg-[#f9f9fd]">
      <header className="border-b border-transparent bg-[#f3f3f7]/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-center">
          <span className="text-lg font-semibold tracking-tight text-[#480054] font-[family-name:var(--font-portal-display)]">
            MaishaPoa
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <CustomerDeepLinkPage customerId={customerId} initialContext={ctx} />
      </main>
      <footer className="mx-auto max-w-lg px-4 pb-8 text-center text-sm text-[#4f434e]">
        <p>Need help? Contact support using the numbers in your welcome message.</p>
      </footer>
    </div>
  );
}
