'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getMemberNumberReconciliation,
  reconcilePolicyMemberNumbers,
  type MemberNumberReconciliationRow,
} from '@/lib/api';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Fragment } from 'react';

export default function MemberNumberReconciliationPage() {
  const [rows, setRows] = useState<MemberNumberReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<MemberNumberReconciliationRow | null>(null);
  const [newPolicyNumber, setNewPolicyNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMemberNumberReconciliation();
      setRows(res.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rowKey = (r: MemberNumberReconciliationRow) =>
    r.policyId ?? r.customerId;

  const openEdit = (row: MemberNumberReconciliationRow) => {
    if (!row.policyId) return;
    setEditRow(row);
    setNewPolicyNumber(row.policyNumber ?? '');
    setDialogError(null);
  };

  const closeEdit = () => {
    setEditRow(null);
    setNewPolicyNumber('');
    setDialogError(null);
  };

  const handleReconcile = async () => {
    if (!editRow?.policyId) return;
    const trimmed = newPolicyNumber.trim();
    if (!trimmed) {
      setDialogError('Policy number is required');
      return;
    }
    if (trimmed.length > 15) {
      setDialogError('Policy number must be at most 15 characters');
      return;
    }
    try {
      setSubmitting(true);
      setDialogError(null);
      await reconcilePolicyMemberNumbers(editRow.policyId, trimmed);
      closeEdit();
      await load();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Failed to reconcile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Member Number Reconciliation</h1>
        <p className="text-muted-foreground mt-1">
          First 50 customers by creation date. Align policy numbers and member numbers with issued cards. Temporary feature.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-900 rounded-md">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation list</CardTitle>
            <CardDescription>
              Expand a row to see dependants. Edit policy number only when a policy exists (no Edit for N/A).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Full name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>ID number</TableHead>
                  <TableHead className="text-right">Dependant count</TableHead>
                  <TableHead>Policy number</TableHead>
                  <TableHead>Principal member #</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const key = rowKey(row);
                  const isOpen = openRowId === key;
                  const hasPolicy = row.policyId != null;
                  const hasDetail = hasPolicy && (row.dependants.length > 0 || row.principalMemberNumber != null);

                  return (
                    <Fragment key={key}>
                      <TableRow className="align-top">
                        <TableCell className="p-1">
                          {hasDetail ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setOpenRowId(isOpen ? null : key)}
                              aria-label={isOpen ? 'Collapse' : 'Expand'}
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          ) : (
                            <span className="inline-block w-8" />
                          )}
                        </TableCell>
                        <TableCell>{row.fullName}</TableCell>
                        <TableCell>{row.phoneNumber}</TableCell>
                        <TableCell>{row.idNumber}</TableCell>
                        <TableCell className="text-right">{row.dependantCount}</TableCell>
                        <TableCell>{row.policyNumber ?? 'N/A'}</TableCell>
                        <TableCell>{row.principalMemberNumber ?? '—'}</TableCell>
                        <TableCell>
                          {hasPolicy && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(row)}
                              aria-label="Edit policy number"
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {hasDetail && isOpen && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={8} className="p-4">
                            <div className="pl-6 space-y-2">
                              <div className="font-medium text-sm">Dependants</div>
                              {row.dependants.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No dependants with member numbers.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Full name</TableHead>
                                      <TableHead>Member number</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {row.dependants.map((d, i) => (
                                      <TableRow key={i}>
                                        <TableCell>{d.fullName}</TableCell>
                                        <TableCell>{d.memberNumber}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-8">No customers found.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={editRow != null} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reconcile policy number</DialogTitle>
            <DialogDescription>
              {editRow?.fullName} — enter the correct policy number (max 15 characters). Member numbers will be regenerated (spouse 01, then others).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Current principal member number</Label>
              <Input value={editRow?.principalMemberNumber ?? '—'} disabled className="mt-1" />
            </div>
            {editRow?.dependants && editRow.dependants.length > 0 && (
              <div>
                <Label>Dependants (current member numbers)</Label>
                <ul className="mt-1 text-sm text-muted-foreground space-y-1 border rounded-md p-2 bg-muted/30">
                  {editRow.dependants.map((d, i) => (
                    <li key={i}>
                      {d.fullName}: {d.memberNumber}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <Label htmlFor="new-policy-number">New policy number</Label>
              <Input
                id="new-policy-number"
                value={newPolicyNumber}
                onChange={(e) => setNewPolicyNumber(e.target.value)}
                placeholder="e.g. MP/MFG/007"
                maxLength={15}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Max 15 characters. Must be unique system-wide.</p>
            </div>
            {dialogError && (
              <div className="p-3 bg-red-50 text-red-900 rounded-md text-sm">{dialogError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleReconcile} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
