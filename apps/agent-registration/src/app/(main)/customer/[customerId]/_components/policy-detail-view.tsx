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
import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import {
  type CustomerPolicyDetail,
  type Scheme,
  getPackageSchemes,
  updateCustomerPolicyScheme,
  updatePolicyStaffNumber,
} from '@/lib/api';
import {
  formatInstallmentsPaidDisplay,
  formatPolicyDateTimeParts,
} from '@/lib/policy-display';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function DateTimeValue({ iso }: { iso: string | null | undefined }) {
  const parts = formatPolicyDateTimeParts(iso);
  if (!parts) return <span>—</span>;
  return (
    <span className="text-right">
      <span className="block">{parts.date}</span>
      <span className="block text-xs text-muted-foreground">{parts.time}</span>
    </span>
  );
}

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
  const [staffNumber, setStaffNumber] = useState(data.staffNumber ?? '');
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  useEffect(() => {
    setStaffNumber(data.staffNumber ?? '');
  }, [data.staffNumber]);

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

  const handleStaffNumberSave = async () => {
    if (!policyId || !canEditScheme) return;
    setStaffError(null);
    setStaffSaving(true);
    try {
      await updatePolicyStaffNumber(policyId, staffNumber.trim() || null);
      onSchemeUpdated?.();
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Failed to update staff number');
    } finally {
      setStaffSaving(false);
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
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>{p.packageName}</span>
            {p.planName ? <span>· {p.planName}</span> : null}
            <Badge variant="outline" className="text-xs font-normal shrink-0">
              {data.schemeBillingMode === 'postpaid' ? 'Postpaid' : 'Prepaid'}
            </Badge>
            {!canEditScheme && <span className="text-muted-foreground">· {p.schemeName}</span>}
            {p.underwriterName ? <span className="text-muted-foreground">· {p.underwriterName}</span> : null}
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
          {canEditScheme ? (
            <div className="space-y-2 pt-2 max-w-xs">
              <Label className="text-sm text-muted-foreground">Staff number (LCT)</Label>
              <div className="flex gap-2">
                <Input
                  value={staffNumber}
                  onChange={(e) => setStaffNumber(e.target.value)}
                  placeholder="Optional"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={staffSaving || staffNumber === (data.staffNumber ?? '')}
                  onClick={() => void handleStaffNumberSave()}
                >
                  {staffSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
              {staffError && <p className="text-sm text-destructive">{staffError}</p>}
            </div>
          ) : data.staffNumber ? (
            <p className="text-sm text-muted-foreground">Staff # {data.staffNumber}</p>
          ) : null}
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enrollment</CardTitle>
            <CardDescription>Cover period and payment schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Policy started</span>
              <DateTimeValue iso={e.startDate} />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Policy ending</span>
              <DateTimeValue iso={e.endDate} />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Expected payment end date</span>
              <DateTimeValue iso={e.nominalPaymentPeriodEndDate} />
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
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground">Installments paid</span>
              <span className="inline-flex items-center gap-1">
                {formatInstallmentsPaidDisplay(
                  data.installmentsPaid,
                  data.installmentsPaidApproximate
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Payments made"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {data.paymentsMadeCount ?? 0} payment
                    {(data.paymentsMadeCount ?? 0) === 1 ? '' : 's'} made
                  </TooltipContent>
                </Tooltip>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected installments</span>
              <span>{e.expectedInstallmentCount ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Missed payments</span>
              <span>
                {formatInstallmentsPaidDisplay(
                  data.missedPayments,
                  data.missedPaymentsApproximate
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Next of kin</CardTitle>
          <CardDescription>This policy&apos;s beneficiary (100%)</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {data.nextOfKin ? (
            <div className="space-y-1">
              <p className="font-medium">
                {data.nextOfKin.firstName} {data.nextOfKin.middleName} {data.nextOfKin.lastName}
              </p>
              <p className="text-muted-foreground">{data.nextOfKin.relationship ?? '—'}</p>
              <p className="text-muted-foreground">{data.nextOfKin.percentage}%</p>
            </div>
          ) : (
            <p className="text-muted-foreground">No next of kin linked to this policy.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
