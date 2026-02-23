'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { getCustomerPoliciesList, CustomerPolicyListItem } from '@/lib/api';
import * as Sentry from '@sentry/nextjs';

interface ProductsTabProps {
  customerId: string;
  /** 'admin' or 'dashboard' - used for policy detail link */
  basePath: 'admin' | 'dashboard';
}

export default function ProductsTab({ customerId, basePath }: ProductsTabProps) {
  const router = useRouter();
  const [policies, setPolicies] = useState<CustomerPolicyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCustomerPoliciesList(customerId);
      setPolicies(response.data);
    } catch (err) {
      console.error('Error loading products:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: { component: 'ProductsTab', action: 'load_products' },
          extra: { customerId },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (policyId: string) => {
    router.push(`/${basePath}/customer/${customerId}/policy/${policyId}`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products</CardTitle>
        <CardDescription>
          Policies this customer is enrolled in. Click a row to view product and enrollment details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {policies.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">No products enrolled</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product / Package</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Scheme</TableHead>
                  <TableHead>Underwriter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total premium</TableHead>
                  <TableHead className="text-right">Installment</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Missed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(p.id)}
                  >
                    <TableCell className="font-medium">
                      {p.productName}
                      <span className="block text-xs text-muted-foreground">{p.packageName}</span>
                    </TableCell>
                    <TableCell>{p.planName ?? '—'}</TableCell>
                    <TableCell>{p.schemeName}</TableCell>
                    <TableCell>{p.underwriterName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{p.totalPremium}</TableCell>
                    <TableCell className="text-right">{p.installment}</TableCell>
                    <TableCell className="text-right">{p.installmentsPaid}</TableCell>
                    <TableCell className="text-right">{p.missedPayments}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
