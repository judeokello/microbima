'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  type CustomerPolicyDetail,
  getInternalConfig,
  initiateCustomerOndemandStk,
  type OndemandStkMode,
} from '@/lib/api';
import { formatPhoneNumber, validatePhoneNumber } from '@/lib/phone-validation';
import { usePaymentStatus, type PaymentStatusUpdate } from '@/hooks/usePaymentStatus';
import { mapStkGatewayStatusToSpecVocabulary } from '@/lib/payment-status-vocabulary';
import * as Sentry from '@sentry/nextjs';

export interface RequestPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  policyId: string;
  /** When filter/policy changes, reset sockets + in-flight STK (T027) */
  policyFilterKey: string;
  policyDetail: CustomerPolicyDetail | null;
  defaultPhone: string;
  onPaymentsRefresh?: () => Promise<void>;
}

function notifyPaymentStatus(update: PaymentStatusUpdate, lastKeyRef: MutableRefObject<string | null>) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  const dedupeKey = `${update.stkPushRequestId}:${update.status}`;
  if (lastKeyRef.current === dedupeKey) return;
  lastKeyRef.current = dedupeKey;
  const vocab = mapStkGatewayStatusToSpecVocabulary(update.status);
  const title = 'Payment update';
  const body =
    update.message ||
    (vocab === 'processing'
      ? 'Payment prompt sent. Waiting for customer…'
      : `Status: ${vocab}`);
  try {
    new Notification(title, { body });
  } catch {
    /* ignore */
  }
}

export default function RequestPaymentDialog({
  open,
  onOpenChange,
  customerId,
  policyId,
  policyFilterKey,
  policyDetail,
  defaultPhone,
  onPaymentsRefresh,
}: RequestPaymentDialogProps) {
  const [mode, setMode] = useState<OndemandStkMode>('INSTALLMENTS');
  const [installmentCount, setInstallmentCount] = useState<string>('1');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stkPushEnabled, setStkPushEnabled] = useState(true);
  const [stkPushRequestId, setStkPushRequestId] = useState<string | null>(null);
  const [wsToken, setWsToken] = useState<string | null>(null);

  const onPaymentsRefreshRef = useRef(onPaymentsRefresh);
  onPaymentsRefreshRef.current = onPaymentsRefresh;
  const lastNotifyKeyRef = useRef<string | null>(null);

  const refreshPayments = useCallback(async () => {
    try {
      await onPaymentsRefreshRef.current?.();
    } catch {
      /* non-fatal */
    }
  }, []);

  const { status: wsStatus, isConnected, disconnect } = usePaymentStatus({
    stkPushRequestId,
    wsToken,
    onStatusUpdate: (update) => {
      notifyPaymentStatus(update, lastNotifyKeyRef);
    },
    onComplete: (update) => {
      notifyPaymentStatus(update, lastNotifyKeyRef);
      void refreshPayments();
    },
    onError: (update) => {
      notifyPaymentStatus(update, lastNotifyKeyRef);
      void refreshPayments();
    },
  });

  useEffect(() => {
    if (open && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void getInternalConfig()
      .then((c) => setStkPushEnabled(c.mpesaStkPushEnabled))
      .catch(() => setStkPushEnabled(true));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPhone(defaultPhone ?? '');
  }, [open, defaultPhone]);

  useEffect(() => {
    if (!open || !policyDetail) return;
    if (open && policyDetail.schemeBillingMode === 'prepaid') {
      const inst = parseFloat(policyDetail.installmentAmount);
      if (!Number.isFinite(inst) || inst <= 0) {
        Sentry.captureMessage(
          'On-demand payment: missing or zero installment on prepaid policy (client dialog open)',
          {
            level: 'warning',
            tags: { feature: 'ondemand_payment_request', reason: 'zero_premium_dialog_open' },
            extra: { customerId, policyId, policyFilterKey },
          }
        );
      }
    }
  }, [open, policyDetail, customerId, policyId, policyFilterKey]);

  useEffect(() => {
    setStkPushRequestId(null);
    setWsToken(null);
    setSubmitError(null);
    lastNotifyKeyRef.current = null;
    disconnect();
  }, [policyId, policyFilterKey, disconnect]);

  useEffect(() => {
    if (!open) {
      setStkPushRequestId(null);
      setWsToken(null);
      setSubmitError(null);
      disconnect();
    }
  }, [open, disconnect]);

  const premiumNum = policyDetail ? parseFloat(policyDetail.installmentAmount) : NaN;
  const installmentTotal =
    mode === 'INSTALLMENTS' && Number.isFinite(premiumNum)
      ? Math.round(Number(installmentCount) * premiumNum * 100) / 100
      : null;

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!policyId?.trim()) {
      setSubmitError('No policy selected.');
      return;
    }
    if (!policyDetail) {
      setSubmitError('Policy details are not loaded.');
      return;
    }
    if (policyDetail.schemeBillingMode === 'postpaid') {
      setSubmitError('STK is not available for postpaid policies.');
      return;
    }
    if (!validatePhoneNumber(phone)) {
      setSubmitError('Phone number must be 10 digits starting with 01 or 07');
      return;
    }
    if (mode === 'INSTALLMENTS') {
      const n = Number(installmentCount);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        setSubmitError('Choose 1–5 installments.');
        return;
      }
      if (!Number.isFinite(premiumNum) || premiumNum <= 0) {
        Sentry.captureMessage('On-demand payment submit with invalid premium (client)', {
          level: 'warning',
          tags: { feature: 'ondemand_payment_request', reason: 'submit_zero_premium' },
          extra: { customerId, policyId },
        });
        setSubmitError('Installment amount is missing for this policy. Contact an administrator.');
        return;
      }
      const total = Math.round(n * premiumNum * 100) / 100;
      if (total < 1 || total > 70000) {
        setSubmitError('Total amount must be between 1 and 70,000 KES.');
        return;
      }
    } else {
      const amt = parseFloat(customAmount);
      if (!Number.isFinite(amt) || amt < 1 || amt > 70000) {
        setSubmitError('Custom amount must be between 1 and 70,000 KES.');
        return;
      }
    }

    if (!stkPushEnabled) {
      setSubmitError('M-Pesa STK is currently disabled.');
      return;
    }

    setSubmitting(true);
    try {
      const body =
        mode === 'INSTALLMENTS'
          ? {
              mode: 'INSTALLMENTS' as const,
              installmentCount: Number(installmentCount),
              phoneNumber: phone.replace(/\D/g, ''),
            }
          : {
              mode: 'CUSTOM' as const,
              customAmountKes: Math.round(parseFloat(customAmount) * 100) / 100,
              phoneNumber: phone.replace(/\D/g, ''),
            };
      const res = await initiateCustomerOndemandStk(customerId, policyId, body);
      setStkPushRequestId(res.id);
      setWsToken(res.wsToken ?? null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to start payment');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = wsStatus
    ? mapStkGatewayStatusToSpecVocabulary(wsStatus.status)
    : null;
  const statusMessage = wsStatus?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request payment</DialogTitle>
          <DialogDescription>
            Send an M-Pesa STK prompt for this policy. Use installments (1–5 × installment amount) or a custom
            amount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as OndemandStkMode)}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="INSTALLMENTS" id="m-inst" />
                <Label htmlFor="m-inst" className="font-normal">
                  Installments (1–5 × installment)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CUSTOM" id="m-custom" />
                <Label htmlFor="m-custom" className="font-normal">
                  Custom amount (KES)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'INSTALLMENTS' ? (
            <div className="space-y-2">
              <Label>Number of installments</Label>
              <Select value={installmentCount} onValueChange={setInstallmentCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} × {policyDetail ? policyDetail.installmentAmount : '—'} KES
                      {policyDetail && Number.isFinite(premiumNum)
                        ? ` → ${(Math.round(n * premiumNum * 100) / 100).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} KES`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {installmentTotal != null && (
                <p className="text-sm text-muted-foreground">Total: {installmentTotal.toFixed(2)} KES</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="custom-amt">Amount (KES)</Label>
              <Input
                id="custom-amt"
                type="number"
                min={1}
                max={70000}
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="stk-phone">Phone (M-Pesa)</Label>
            <Input
              id="stk-phone"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="01xxxxxxxx or 07xxxxxxxx"
              maxLength={10}
            />
          </div>

          {[statusLabel, statusMessage].some(Boolean) && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {statusLabel && <p className="font-medium capitalize">{statusLabel}</p>}
              {statusMessage && <p className="text-muted-foreground">{statusMessage}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                WebSocket: {isConnected ? 'connected' : 'disconnected'}
              </p>
            </div>
          )}

          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {submitError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || !!stkPushRequestId}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending…
              </>
            ) : stkPushRequestId ? (
              'STK sent'
            ) : (
              'Send STK'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
