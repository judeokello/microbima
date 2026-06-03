'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchPortalProducts, type PortalProductListItem } from '@/lib/customer-portal-api';
import { Loader2 } from 'lucide-react';

function statusLabel(s: string) {
  const map: Record<string, string> = {
    ACTIVE: 'Active',
    PENDING: 'Pending',
    EXPIRED: 'Expired',
    SUSPENDED: 'Suspended',
    CANCELLED: 'Cancelled',
    TERMINATED: 'Terminated',
  };
  return map[s] ?? s;
}

function statusColor(s: string) {
  if (s === 'ACTIVE') return 'bg-green-50 text-green-700 border-green-200';
  if (s === 'PENDING') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (s === 'SUSPENDED') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export default function PortalProductsPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;
  const router = useRouter();

  const [products, setProducts] = useState<PortalProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetchPortalProducts(session.access_token);
        if (cancelled) return;

        // T037: auto-redirect when exactly one product
        if (res.data.length === 1 && !redirected) {
          setRedirected(true);
          router.replace(
            `/self/customer/${customerId}/products/${res.data[0].id}`,
          );
          return;
        }

        setProducts(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load products');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, router, redirected]);

  if (loading || redirected) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#480054]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-[#4f434e]">No products are linked to your account yet.</p>
        <p className="mt-2 text-xs text-[#4f434e]">
          Contact support using the numbers in your welcome message if you believe this is incorrect.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[#4f434e]">My Products</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#480054] font-[family-name:var(--font-portal-display)]">
          Your Cover
        </h1>
        <p className="mt-1 text-sm text-[#4f434e]">
          Select a product to view details, payments, and your member card.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/self/customer/${customerId}/products/${p.id}`}
            className="group block rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#d2c2cf]/20 transition hover:ring-[#480054]/30 hover:shadow-md"
          >
            {/* Package name + status */}
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#4f434e]">
                  {p.underwriterName ?? p.schemeName}
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-[#480054] font-[family-name:var(--font-portal-display)] leading-tight">
                  {p.packageName}
                  {p.planName ? ` — ${p.planName}` : ''}
                </h2>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColor(p.status)}`}
              >
                {statusLabel(p.status)}
              </span>
            </div>

            {/* Product name */}
            {p.productName && (
              <p className="mb-4 text-sm text-[#4f434e]">{p.productName}</p>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 border-t border-[#d2c2cf]/20 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#4f434e]">Premium</p>
                <p className="mt-0.5 text-sm font-bold text-[#1a1c1f]">
                  KES {Number(p.installment).toLocaleString('en-KE')}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#4f434e]">Paid</p>
                <p className="mt-0.5 text-sm font-bold text-green-700">{p.installmentsPaid}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#4f434e]">Missed</p>
                <p className={`mt-0.5 text-sm font-bold ${p.missedPayments > 0 ? 'text-red-600' : 'text-[#1a1c1f]'}`}>
                  {p.missedPayments}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <span className="text-xs font-semibold text-[#480054] group-hover:underline">
                View details →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
