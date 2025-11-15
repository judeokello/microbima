'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { getCustomerDebugData } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import * as Sentry from '@sentry/nextjs';

export default function CustomerDebugPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const customerId = params.customerId as string;

  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setError('Unauthorized: Admin access required');
      setLoading(false);
      return;
    }

    if (customerId) {
      loadDebugData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, isAdmin]);

  const loadDebugData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCustomerDebugData(customerId);
      setDebugData(response.data);
    } catch (err) {
      console.error('Error loading debug data:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'CustomerDebugPage',
            action: 'load_debug_data',
          },
          extra: {
            customerId,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to load debug data');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Unauthorized</CardTitle>
            <CardDescription>Admin access required to view debug data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-600" />
          <p className="mt-2 text-gray-600">Loading debug data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go back
              </Button>
              <Button onClick={loadDebugData}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!debugData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">No debug data available</p>
      </div>
    );
  }

  const formatJson = (data: any) => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Debug Data</h1>
          <p className="text-gray-600 mt-2">
            Raw database records for customer: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{customerId}</code>
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/admin/customer/${customerId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customer
        </Button>
      </div>

      {/* Customer */}
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
          <CardDescription>Customer record</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
            {formatJson(debugData.customer)}
          </pre>
        </CardContent>
      </Card>

      {/* Dependants */}
      <Card>
        <CardHeader>
          <CardTitle>Dependants</CardTitle>
          <CardDescription>
            {debugData.dependants?.length ?? 0} dependant record(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {debugData.dependants && debugData.dependants.length > 0 ? (
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
              {formatJson(debugData.dependants)}
            </pre>
          ) : (
            <p className="text-gray-500">No dependants found</p>
          )}
        </CardContent>
      </Card>

      {/* Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Policies</CardTitle>
          <CardDescription>
            {debugData.policies?.length ?? 0} policy record(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {debugData.policies && debugData.policies.length > 0 ? (
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
              {formatJson(debugData.policies)}
            </pre>
          ) : (
            <p className="text-gray-500">No policies found</p>
          )}
        </CardContent>
      </Card>

      {/* Policy Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Payments</CardTitle>
          <CardDescription>
            {debugData.policyPayments?.length ?? 0} payment record(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {debugData.policyPayments && debugData.policyPayments.length > 0 ? (
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
              {formatJson(debugData.policyPayments)}
            </pre>
          ) : (
            <p className="text-gray-500">No policy payments found</p>
          )}
        </CardContent>
      </Card>

      {/* Policy Member Principals */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Member Principals</CardTitle>
          <CardDescription>
            {debugData.policyMemberPrincipals?.length ?? 0} principal member record(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {debugData.policyMemberPrincipals && debugData.policyMemberPrincipals.length > 0 ? (
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
              {formatJson(debugData.policyMemberPrincipals)}
            </pre>
          ) : (
            <p className="text-gray-500">No policy member principals found</p>
          )}
        </CardContent>
      </Card>

      {/* Policy Member Dependants */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Member Dependants</CardTitle>
          <CardDescription>
            {debugData.policyMemberDependants?.length ?? 0} dependant member record(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {debugData.policyMemberDependants && debugData.policyMemberDependants.length > 0 ? (
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">
              {formatJson(debugData.policyMemberDependants)}
            </pre>
          ) : (
            <p className="text-gray-500">No policy member dependants found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


