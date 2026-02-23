'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  type CustomerPolicyDetail,
  type Scheme,
  getPackageSchemes,
  updateCustomerPolicyScheme,
} from '@/lib/api';

interface PolicyDetailViewProps {
  data: CustomerPolicyDetail;
  backUrl: string;
  backLabel?: string;
  /** When true, scheme is editable (registration_admin only) */
  canEditScheme?: boolean;
  /** Required when canEditScheme: for loading schemes and PATCH */
  customerId?: string;
  /** Required when canEditScheme: for PATCH */
  policyId?: string;
  /** Called after scheme is updated so parent can refresh detail */
  onSchemeUpdated?: () => void;
}

export default function PolicyDetailView({
  data,
  backUrl,
  backLabel = 'Back to customer',
  canEditScheme = false,
  customerId = '',
  policyId = '',
  onSchemeUpdated,
}: PolicyDetailViewProps) {
  const p = data.product;
  const e = data.enrollment;

  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [schemesLoading, setSchemesLoading] = useState(false);
  const [schemeUpdating, setSchemeUpdating] = useState(false);
  const [schemeError, setSchemeError] = useState<string | null>(null);

  useEffect(() => {
    if (!canEditScheme || !data.packageId) return;
    let cancelled = false;
    setSchemesLoading(true);
    getPackageSchemes(data.packageId)
      .then((list) => {
        if (!cancelled) setSchemes(list);
      })
      .catch(() => {
        if (!cancelled) setSchemes([]);
      })
      .finally(() => {
        if (!cancelled) setSchemesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canEditScheme, data.packageId]);

  const handleSchemeChange = async (value: string) => {
    const newPackageSchemeId = Number(value);
    if (!customerId || !policyId || Number.isNaN(newPackageSchemeId)) return;
    setSchemeError(null);
    setSchemeUpdating(true);
    try {
      await updateCustomerPolicyScheme(customerId, policyId, newPackageSchemeId);
      onSchemeUpdated?.();
    } catch (err) {
      setSchemeError(err instanceof Error ? err.message : 'Failed to update scheme');
    } finally {
      setSchemeUpdating(false);
    }
  };

  const schemeValue =
    data.packageSchemeId != null ? String(data.packageSchemeId) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {p.productName}
            <Badge variant={data.status === 'ACTIVE' ? 'default' : 'secondary'}>{data.status}</Badge>
          </CardTitle>
          <CardDescription>
            {p.packageName}
            {p.planName ? ` · ${p.planName}` : ''}
            {!canEditScheme && ` · ${p.schemeName}`}
            {p.underwriterName ? ` · ${p.underwriterName}` : ''}
          </CardDescription>
          {canEditScheme && (
            <div className="space-y-2 pt-2">
              <Label className="text-sm text-muted-foreground">Scheme</Label>
              {schemesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading schemes…
                </div>
              ) : (
                <Select
                  value={schemeValue}
                  onValueChange={handleSchemeChange}
                  disabled={schemeUpdating || schemes.length === 0}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Select scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {schemes.map((s) => (
                      <SelectItem
                        key={s.packageSchemeId ?? s.id}
                        value={String(s.packageSchemeId ?? s.id)}
                      >
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {schemeUpdating && (
                <p className="text-xs text-muted-foreground">Updating…</p>
              )}
              {schemeError && (
                <p className="text-sm text-destructive">{schemeError}</p>
              )}
            </div>
          )}
          {data.policyNumber && (
            <p className="text-sm text-muted-foreground">Policy # {data.policyNumber}</p>
          )}
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enrollment</CardTitle>
            <CardDescription>Cover period and payment schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start date</span>
              <span>{e.startDate ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End date</span>
              <span>{e.endDate ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frequency</span>
              <span>{e.frequency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment cadence</span>
              <span>{e.paymentCadence}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment summary</CardTitle>
            <CardDescription>Premium and installments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Premium</span>
              <span>{data.totalPremium}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Installment Amount</span>
              <span>{data.installmentAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total paid to date</span>
              <span>{data.totalPaidToDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Installments paid</span>
              <span>{data.installmentsPaid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Missed payments</span>
              <span>{data.missedPayments}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
