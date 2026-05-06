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
  return <CustomerDeepLinkPage customerId={customerId} initialContext={ctx} />;
}
