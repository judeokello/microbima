'use client';

import { useEffect, useState } from 'react';
import { getMemberCards } from '@/lib/api';
import type { MemberCardsByPolicyItem } from '@/types/member-card';
import MemberCardWithDownload from '@/components/member-cards/MemberCardWithDownload';

interface MemberCardsTabProps {
  customerId: string;
}

export default function MemberCardsTab({ customerId }: MemberCardsTabProps) {
  const [data, setData] = useState<MemberCardsByPolicyItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await getMemberCards(customerId);
        if (!cancelled) setData(res.memberCardsByPolicy);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load member cards');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading member cards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No member cards available
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {data.map((policy) => (
        <section key={policy.policyId} className="space-y-4">
          <h3 className="text-lg font-semibold">
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
