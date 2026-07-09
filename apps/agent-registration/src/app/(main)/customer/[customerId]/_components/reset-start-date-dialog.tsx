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
import { Loader2 } from 'lucide-react';

interface ResetStartDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string, startDateIso: string) => Promise<void>;
}

export default function ResetStartDateDialog({
  open,
  onOpenChange,
  onSubmit,
}: ResetStartDateDialogProps) {
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }
    const [y, m, d] = startDate.split('-').map(Number);
    const iso = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason.trim(), iso);
      onOpenChange(false);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset start date</DialogTitle>
          <DialogDescription>
            Updates policy start and end dates only. Earlier payments stay on the policy but are
            treated as lost for coverage accounting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="reset-start">New start date</Label>
            <Input
              id="reset-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reset-reason">Reason (required)</Label>
            <Textarea
              id="reset-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reset start date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
