'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import {
  detachPaymentsFromPolicy,
  listDetachablePayments,
  type DetachablePaymentItem,
} from '@/lib/api';

interface DetachPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  policyId: string;
  productName: string;
  onSuccess: (message: string) => void;
}

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DetachPaymentsDialog({
  open,
  onOpenChange,
  customerId,
  policyId,
  productName,
  onSuccess,
}: DetachPaymentsDialogProps) {
  const [items, setItems] = useState<DetachablePaymentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setItems([]);
    setSelectedIds(new Set());
    setNewAccountNumber('');
    setReason('');
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listDetachablePayments(customerId, policyId);
        if (cancelled) return;
        setItems(res.items);
        if (res.items.length === 0) {
          setError('No detachable payments found on this policy');
        }
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(e instanceof Error ? e.message : 'Failed to load payments');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, customerId, policyId]);

  const selectedTotal = useMemo(() => {
    return items
      .filter((i) => selectedIds.has(i.id))
      .reduce((sum, i) => sum + i.amount, 0);
  }, [items, selectedIds]);

  const toggleId = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(items.map((i) => i.id)));
    else setSelectedIds(new Set());
  };

  const handleSubmit = async () => {
    if (!newAccountNumber.trim()) {
      setError('New account number is required');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Select at least one payment');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await detachPaymentsFromPolicy(customerId, policyId, {
        paymentIds: [...selectedIds],
        newAccountNumber: newAccountNumber.trim(),
        reason: reason.trim(),
      });
      onSuccess(res.message);
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detach failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detach payments</DialogTitle>
          <DialogDescription>
            Soft-detach selected payments from {productName}. Update the IPN account number so
            payments can rematch to the correct policy when possible.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-md border max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={items.length > 0 && selectedIds.size === items.length}
                          onCheckedChange={(c) => toggleAll(c === true)}
                          disabled={items.length === 0 || submitting}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={(c) => toggleId(item.id, c === true)}
                            disabled={submitting}
                            aria-label={`Select ${item.transactionReference}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.transactionReference}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(item.actualPaymentDate ?? item.expectedPaymentDate).slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-right">{formatKes(item.amount)}</TableCell>
                        <TableCell className="text-xs">{item.paymentStatus}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-sm font-medium">
                Selected: {selectedIds.size} — Total: {formatKes(selectedTotal)}
              </p>

              <div className="space-y-2">
                <Label htmlFor="detach-account">New account number (required)</Label>
                <Input
                  id="detach-account"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  disabled={submitting}
                  placeholder="Correct payment account number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="detach-reason">Reason (required)</Label>
                <Textarea
                  id="detach-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={400}
                  disabled={submitting}
                />
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={
              submitting ||
              loading ||
              selectedIds.size === 0 ||
              !reason.trim() ||
              !newAccountNumber.trim()
            }
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Detach selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
