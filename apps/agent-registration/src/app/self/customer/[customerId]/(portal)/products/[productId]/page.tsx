'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  fetchPortalProductDetail,
  fetchPortalPolicies,
  fetchPortalPayments,
  fetchPortalMemberCards,
  type PortalProductDetail,
  type PortalPolicyOption,
  type PortalPayment,
  type PortalMemberCardsResponse,
} from '@/lib/customer-portal-api';
import { Loader2 } from 'lucide-react';
import MemberCardWithDownload from '@/components/member-cards/MemberCardWithDownload';

type Tab = 'details' | 'products' | 'payments' | 'member-cards';

// ── Details tab ───────────────────────────────────────────────────────────────

function DetailsTab({ detail }: { detail: PortalProductDetail }) {
  const {
    status,
    schemeBillingMode,
    product,
    enrollment,
    totalPremium,
    installmentAmount,
    totalPaidToDate,
    installmentsPaid,
    missedPayments,
  } = detail;

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('en-KE', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—';

  return (
    <div className="space-y-4">
      {/* Core info */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#d2c2cf]/20">
        <h3 className="mb-4 text-base font-bold text-[#480054] font-[family-name:var(--font-portal-display)]">
          Cover Information
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          {[
            ['Package', product.packageName],
            ['Plan', product.planName ?? '—'],
            ['Scheme', product.schemeName],
            ['Underwriter', product.underwriterName ?? '—'],
            ['Billing', schemeBillingMode === 'prepaid' ? 'Prepaid' : 'Postpaid'],
            ['Status', status],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wider text-[#4f434e]">{label}</p>
              <p className="mt-0.5 text-sm font-semibold text-[#1a1c1f]">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Enrolment */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#d2c2cf]/20">
        <h3 className="mb-4 text-base font-bold text-[#480054] font-[family-name:var(--font-portal-display)]">
          Enrolment
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          {[
            ['Start date', formatDate(enrollment.startDate)],
            ['End date', formatDate(enrollment.endDate)],
            ['Frequency', enrollment.frequency],
            ['Cadence (days)', String(enrollment.paymentCadence)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wider text-[#4f434e]">{label}</p>
              <p className="mt-0.5 text-sm font-semibold text-[#1a1c1f]">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Financials */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#d2c2cf]/20">
        <h3 className="mb-4 text-base font-bold text-[#480054] font-[family-name:var(--font-portal-display)]">
          Financials
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          {[
            ['Total premium', `KES ${Number(totalPremium).toLocaleString('en-KE')}`],
            ['Installment', `KES ${Number(installmentAmount).toLocaleString('en-KE')}`],
            ['Total paid', `KES ${Number(totalPaidToDate).toLocaleString('en-KE')}`],
            ['Installments paid', String(installmentsPaid)],
            ['Missed', String(missedPayments)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wider text-[#4f434e]">{label}</p>
              <p className={`mt-0.5 text-sm font-semibold ${label === 'Missed' && missedPayments > 0 ? 'text-red-600' : 'text-[#1a1c1f]'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Products tab (list of all products) ─────────────────────────────────────

function ProductsTab({
  accessToken,
  customerId,
  currentPolicyId,
}: {
  accessToken: string;
  customerId: string;
  currentPolicyId: string;
}) {
  const [products, setProducts] = useState<
    Array<{ id: string; displayText: string; packageName: string; planName?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchPortalPolicies(accessToken);
        if (!cancelled) setProducts(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-[#480054]" />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-3">
      {products.map((p) => (
        <Link
          key={p.id}
          href={`/self/customer/${customerId}/products/${p.id}`}
          className={`block rounded-2xl p-4 ring-1 transition ${
            p.id === currentPolicyId
              ? 'bg-[#480054]/5 ring-[#480054]/30 font-semibold text-[#480054]'
              : 'bg-white ring-[#d2c2cf]/20 text-[#1a1c1f] hover:ring-[#480054]/20 hover:bg-[#f3f3f7]'
          }`}
        >
          <p className="text-sm">{p.displayText}</p>
          {p.id === currentPolicyId && (
            <p className="mt-0.5 text-xs text-[#480054]">Currently viewing</p>
          )}
        </Link>
      ))}
    </div>
  );
}

// ── Payments tab ─────────────────────────────────────────────────────────────

function PaymentsTab({
  accessToken,
  policies,
  preSelectedPolicyId,
}: {
  accessToken: string;
  policies: PortalPolicyOption[];
  preSelectedPolicyId: string;
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState(preSelectedPolicyId);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [payments, setPayments] = useState<PortalPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilter = useCallback(async () => {
    if (!selectedPolicyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPortalPayments(accessToken, {
        policyId: selectedPolicyId,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setPayments(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedPolicyId, fromDate, toDate]);

  // Run initial filter on mount when policy is pre-selected
  useEffect(() => {
    if (preSelectedPolicyId) {
      void handleFilter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const statusColor = (s?: string) => {
    if (s === 'COMPLETED' || s === 'COMPLETED_PENDING_RECEIPT') return 'text-green-700';
    if (s === 'PENDING') return 'text-amber-700';
    if (s === 'FAILED') return 'text-red-600';
    return 'text-[#4f434e]';
  };

  const singlePolicy = policies.length === 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#d2c2cf]/20">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="portal-policy" className="block text-xs font-medium text-[#4f434e] mb-1">
              Package – Plan
            </label>
            <select
              id="portal-policy"
              value={selectedPolicyId}
              onChange={(e) => setSelectedPolicyId(e.target.value)}
              disabled={singlePolicy}
              className="w-full rounded-xl border border-[#d2c2cf]/40 bg-[#f3f3f7] px-3 py-2 text-sm text-[#1a1c1f] focus:border-[#480054] focus:outline-none disabled:opacity-60"
            >
              <option value="">Select policy</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayText}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="portal-from" className="block text-xs font-medium text-[#4f434e] mb-1">
              From
            </label>
            <input
              id="portal-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-[#d2c2cf]/40 bg-[#f3f3f7] px-3 py-2 text-sm text-[#1a1c1f] focus:border-[#480054] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="portal-to" className="block text-xs font-medium text-[#4f434e] mb-1">
              To
            </label>
            <input
              id="portal-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-[#d2c2cf]/40 bg-[#f3f3f7] px-3 py-2 text-sm text-[#1a1c1f] focus:border-[#480054] focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleFilter()}
              disabled={!selectedPolicyId || loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#480054] to-[#631c6e] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Filter'}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Results */}
      {payments.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-[#d2c2cf]/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f3f3f7]">
                <tr>
                  {['Expected Date', 'Paid Date', 'Amount (KES)', 'Status', 'Reference'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#4f434e]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2c2cf]/10">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#f9f9fd]">
                    <td className="px-4 py-3 text-[#1a1c1f]">{formatDate(p.expectedPaymentDate)}</td>
                    <td className="px-4 py-3 text-[#4f434e]">
                      {p.actualPaymentDate ? formatDate(p.actualPaymentDate) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1a1c1f]">
                      {p.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`px-4 py-3 font-medium ${statusColor(p.paymentStatus)}`}>
                      {p.paymentStatus ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#4f434e]">
                      {p.transactionReference || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && payments.length === 0 && selectedPolicyId && (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-[#d2c2cf]/20">
          <p className="text-sm text-[#4f434e]">No payments found for the selected filters.</p>
        </div>
      )}
    </div>
  );
}

// ── Member Cards tab ─────────────────────────────────────────────────────────

function MemberCardsTab({ cards }: { cards: PortalMemberCardsResponse }) {
  if (!cards.memberCardsByPolicy || cards.memberCardsByPolicy.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-[#d2c2cf]/20">
        <p className="text-sm text-[#4f434e]">No member cards available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {cards.memberCardsByPolicy.map((policy) => (
        <section key={policy.policyId} className="space-y-4">
          <h3 className="text-base font-semibold text-[#1a1c1f]">
            {policy.packageName}
            {policy.policyNumber ? ` — ${policy.policyNumber}` : ''}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MemberCardWithDownload
              data={policy.principal}
              templateName={policy.cardTemplateName}
            />
            {policy.dependants.map((dep, idx) => (
              <MemberCardWithDownload
                key={idx}
                data={dep}
                templateName={policy.cardTemplateName}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PortalProductDetailPage() {
  const params = useParams<{ customerId: string; productId: string }>();
  const { customerId, productId } = params;
  const router = useRouter();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [detail, setDetail] = useState<PortalProductDetail | null>(null);
  const [policies, setPolicies] = useState<PortalPolicyOption[]>([]);
  const [cards, setCards] = useState<PortalMemberCardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('details');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.replace('/self/customer');
        return;
      }

      const token = session.access_token;
      if (!cancelled) setAccessToken(token);

      try {
        const [detailRes, policiesRes, cardsRes] = await Promise.all([
          fetchPortalProductDetail(token, productId),
          fetchPortalPolicies(token),
          fetchPortalMemberCards(token),
        ]);
        if (cancelled) return;
        setDetail(detailRes.data);
        setPolicies(policiesRes.data);
        setCards(cardsRes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [customerId, productId, router]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Customer Details' },
    { id: 'products', label: 'Products' },
    { id: 'payments', label: 'Payments' },
    { id: 'member-cards', label: 'Member Cards' },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#480054]" />
      </div>
    );
  }

  if (error || !detail || !accessToken) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">{error ?? 'Product not found'}</p>
        <Link
          href={`/self/customer/${customerId}/products`}
          className="mt-4 inline-block text-sm font-medium text-[#480054] underline"
        >
          ← Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div>
        <Link
          href={`/self/customer/${customerId}/products`}
          className="text-xs font-medium text-[#480054] hover:underline"
        >
          ← My Products
        </Link>
        <p className="mt-2 text-xs uppercase tracking-widest text-[#4f434e]">
          {detail.product.underwriterName ?? detail.product.schemeName}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#480054] font-[family-name:var(--font-portal-display)]">
          {detail.product.packageName}
          {detail.product.planName ? ` — ${detail.product.planName}` : ''}
        </h1>
        {detail.product.productName && (
          <p className="mt-1 text-sm text-[#4f434e]">{detail.product.productName}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-2xl bg-[#f3f3f7] p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white text-[#480054] shadow-sm font-semibold'
                : 'text-[#4f434e] hover:bg-[#ededf1]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'details' && <DetailsTab detail={detail} />}
      {tab === 'products' && (
        <ProductsTab
          accessToken={accessToken}
          customerId={customerId}
          currentPolicyId={productId}
        />
      )}
      {tab === 'payments' && (
        <PaymentsTab
          accessToken={accessToken}
          policies={policies}
          preSelectedPolicyId={productId}
        />
      )}
      {tab === 'member-cards' && cards && <MemberCardsTab cards={cards} />}
    </div>
  );
}
