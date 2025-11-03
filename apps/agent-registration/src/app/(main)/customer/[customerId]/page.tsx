'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { getCustomerDetails, CustomerDetailData } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import CustomerInfoSection from './_components/customer-info-section';
import NextOfKinSection from './_components/next-of-kin-section';
import SpouseSection from './_components/spouse-section';
import ChildrenSection from './_components/children-section';
import PaymentsTab from './_components/payments-tab';
import { useEditPermissions } from './_hooks/use-edit-permissions';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const customerId = params.customerId as string;

  const [customerData, setCustomerData] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { canEdit } = useEditPermissions(customerId, user?.id ?? '');

  useEffect(() => {
    if (customerId) {
      loadCustomerDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const loadCustomerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCustomerDetails(customerId);
      setCustomerData(response.data);
    } catch (err) {
      console.error('Error loading customer details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customer details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-600" />
          <p className="mt-2 text-gray-600">Loading customer details...</p>
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
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:underline"
            >
              ← Go back
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">Customer not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customer Details</h1>
        <p className="text-gray-600 mt-2">
          View and manage customer information, family members, and payment history
        </p>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Customer Details</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <CustomerInfoSection
            customer={customerData.customer}
            canEdit={canEdit}
            onUpdate={loadCustomerDetails}
          />

          <NextOfKinSection
            beneficiaries={customerData.beneficiaries}
            canEdit={canEdit}
            canAdd={canEdit}
            onUpdate={loadCustomerDetails}
          />

          <SpouseSection
            dependants={customerData.dependants.filter((d) => d.relationship === 'SPOUSE')}
            canEdit={canEdit}
            canAdd={canEdit}
            onUpdate={loadCustomerDetails}
          />

          <ChildrenSection
            dependants={customerData.dependants.filter((d) => d.relationship === 'CHILD')}
            canEdit={canEdit}
            canAdd={canEdit}
            onUpdate={loadCustomerDetails}
          />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab customerId={customerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
