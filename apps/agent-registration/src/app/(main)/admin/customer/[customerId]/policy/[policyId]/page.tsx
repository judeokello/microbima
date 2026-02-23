'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { getCustomerPolicyDetail, CustomerPolicyDetail } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import * as Sentry from '@sentry/nextjs';
import PolicyDetailView from '@/app/(main)/customer/[customerId]/_components/policy-detail-view';

export default function AdminCustomerPolicyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const customerId = params.customerId as string;
  const policyId = params.policyId as string;

  const [data, setData] = useState<CustomerPolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId && policyId) {
      loadDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, policyId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCustomerPolicyDetail(customerId, policyId);
      setData(response.data);
    } catch (err) {
      console.error('Error loading policy detail:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: { component: 'AdminCustomerPolicyDetailPage', action: 'load_policy_detail' },
          extra: { customerId, policyId },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-600" />
          <p className="mt-2 text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => router.push(`/admin/customer/${customerId}`)}
              className="text-blue-600 hover:underline"
            >
              ← Back to customer
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-gray-600">Policy not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Product details</h1>
        <p className="mt-2 text-gray-600">Policy and enrollment information</p>
      </div>
      <PolicyDetailView
        data={data}
        backUrl={`/admin/customer/${customerId}`}
        backLabel="Back to customer"
        canEditScheme={isAdmin}
        customerId={customerId}
        policyId={policyId}
        onSchemeUpdated={loadDetail}
      />
    </div>
  );
}
