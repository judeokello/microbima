'use client';

import { useState } from 'react';
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
  listUnmappedMpesaPaymentsForRemap,
  remapMpesaPaymentsToPolicy,
  type UnmappedMpesaPaymentItem,
} from '@/lib/api';

interface RemapPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  policyId: string;
  productName: string;
  onSuccess: (message: string) => void;
}

export default function RemapPaymentsDialog({
  open,
  onOpenChange,
  customerId,
  policyId,
  productName,
  onSuccess,
}: RemapPaymentsDialogProps) {
  const [accountNumber, setAccountNumber] = useState('');
  const [items, setItems] = useState<UnmappedMpesaPaymentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState(false);

  const resetState = () => {
    setAccountNumber('');
    setItems([]);
    setSelectedIds(new Set());
    setReason('');
    setError(null);
    setLookedUp(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const handleLookup = async () => {
    if (!accountNumber.trim()) {
      setError('Payment account number is required');
      return;
    }
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const res = await listUnmappedMpesaPaymentsForRemap(
        customerId,
        policyId,
        accountNumber.trim()
      );
      setItems(res.items);
      setLookedUp(true);
      if (res.items.length === 0) {
        setError('No unmapped processed payments found for that account number');
      }
    } catch (e) {
      setItems([]);
      setLookedUp(false);
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleId = (id: string, checked: boolean) => {
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
      const res = await remapMpesaPaymentsToPolicy(customerId, policyId, {
        accountNumber: accountNumber.trim(),
        itemIds: [...selectedIds],
        reason: reason.trim(),
      });
      const msg = res.note ? `${res.message}. ${res.note}` : res.message;
      onSuccess(msg);
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remap failed');
    } finally {
      setSubmitting(false);
    }
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remap payments</DialogTitle>
          <DialogDescription>
            Look up unmapped M-Pesa payments by the account number entered on M-Pesa, then map
            selected payments onto {productName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="remap-account">Payment account number entered</Label>
              <Input
                id="remap-account"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Wrong account number from M-Pesa"
                disabled={loading || submitting}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleLookup()}
              disabled={loading || submitting}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Load
            </Button>
          </div>

          {lookedUp && items.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => toggleAll(v === true)}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={(v) => toggleId(item.id, v === true)}
                          aria-label={`Select ${item.transactionReference}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.transactionReference}
                      </TableCell>
                      <TableCell>{item.paidIn.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(item.completionTime).toLocaleString()}
                      </TableCell>
                      <TableCell>{item.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <Label htmlFor="remap-reason">Reason (required)</Label>
            <Textarea
              id="remap-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={400}
              disabled={submitting}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || selectedIds.size === 0 || !reason.trim()}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Remap selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
