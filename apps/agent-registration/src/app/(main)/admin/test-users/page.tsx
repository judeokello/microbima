'use client';

import { useState, useEffect, useCallback } from 'react';
import { notFound } from 'next/navigation';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatPhoneNumber } from '@/lib/utils';

interface TestCustomer {
  id: string;
  name: string;
  phoneNumber: string;
  createdAt: string;
  createdBy: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface TestCustomersResponse {
  data: TestCustomer[];
  pagination: PaginationInfo;
}

interface DeletePreviewResult {
  customersCount: number;
  totalCustomersWithPhone: number;
  customer?: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
}

export default function TestUsersPage() {
  const [testCustomers, setTestCustomers] = useState<TestCustomer[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestCustomer | null>(null);
  const [hardDeleteChecked, setHardDeleteChecked] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeletePreviewResult | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deletePreviewError, setDeletePreviewError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('Not authenticated');
    }
    return session.session.access_token;
  };

  const getApiBaseUrl = () => {
    const url = process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL;
    if (!url) throw new Error('NEXT_PUBLIC_INTERNAL_API_BASE_URL not configured');
    return url;
  };

  const fetchTestCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(
        `${getApiBaseUrl()}/internal/test-customers?${params}`,
        {
          headers: {
            Authorization: `Bearer ${await getSupabaseToken()}`,
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        }
      );

      if (response.status === 404) {
        notFound();
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg =
          errorData.error?.details?.phoneNumber ??
          errorData.error?.message ??
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(msg);
      }

      const data: TestCustomersResponse = await response.json();
      setTestCustomers(data.data);
      setPagination(data.pagination);
    } catch (err) {
      if (err && typeof err === 'object' && 'digest' in err) return; // notFound throws
      setError(err instanceof Error ? err.message : 'Failed to fetch test users');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchTestCustomers();
  }, [fetchTestCustomers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addPhone.trim()) return;

    try {
      setAdding(true);
      setAddError(null);

      const response = await fetch(
        `${getApiBaseUrl()}/internal/test-customers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getSupabaseToken()}`,
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
          body: JSON.stringify({ name: addName.trim(), phoneNumber: addPhone.trim() }),
        }
      );

      if (response.status === 404) {
        notFound();
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg =
          errorData.error?.details?.phoneNumber ??
          errorData.error?.message ??
          'Failed to add test user';
        throw new Error(msg);
      }

      setAddName('');
      setAddPhone('');
      setAddDialogOpen(false);
      await fetchTestCustomers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add test user');
    } finally {
      setAdding(false);
    }
  };

  const openDeleteDialog = (tc: TestCustomer) => {
    setDeleteTarget(tc);
    setDeleteDialogOpen(true);
    setHardDeleteChecked(false);
    setDeletePreview(null);
    setDeletePreviewError(null);
    setConfirmText('');
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    setHardDeleteChecked(false);
    setDeletePreview(null);
    setDeletePreviewError(null);
    setConfirmText('');
    setDeletingId(null);
  };

  const fetchDeletePreview = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeletePreviewLoading(true);
      setDeletePreview(null);
      setDeletePreviewError(null);

      const response = await fetch(
        `${getApiBaseUrl()}/internal/test-customers/${deleteTarget.id}/delete-preview`,
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${await getSupabaseToken()}`,
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        }
      );

      if (response.status === 404) {
        notFound();
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error?.message ?? `Failed to fetch delete preview (${response.status})`
        );
      }

      const data: DeletePreviewResult = await response.json();
      setDeletePreview(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch delete preview';
      setDeletePreviewError(msg);
      setDeletePreview(null);
    } finally {
      setDeletePreviewLoading(false);
    }
  }, [deleteTarget]);

  useEffect(() => {
    if (hardDeleteChecked && deleteTarget) {
      fetchDeletePreview();
    } else {
      setDeletePreview(null);
      setDeletePreviewError(null);
    }
  }, [hardDeleteChecked, deleteTarget, fetchDeletePreview]);

  const confirmationString =
    deletePreview?.customer
      ? `DELETE ${(deletePreview.customer.firstName ?? '').trim()} ${(deletePreview.customer.lastName ?? '').trim()} ${(deletePreview.customer.phoneNumber ?? '').trim()}`
      : '';

  const canDelete =
    !hardDeleteChecked ||
    (deletePreview?.customersCount === 1 &&
      deletePreview.customer &&
      confirmText === confirmationString);

  const multipleCustomersError = hardDeleteChecked && deletePreview && deletePreview.customersCount > 1;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!canDelete) return;
    if (multipleCustomersError) return;

    try {
      setDeletingId(deleteTarget.id);

      const url = new URL(
        `${getApiBaseUrl()}/internal/test-customers/${deleteTarget.id}`
      );
      if (hardDeleteChecked && deletePreview?.customersCount === 1) {
        url.searchParams.set('deleteCustomerRecord', 'true');
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${await getSupabaseToken()}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      });

      if (response.status === 404) {
        notFound();
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg =
          errorData.error?.message ??
          `Failed to delete: ${response.statusText}`;
        throw new Error(msg);
      }

      closeDeleteDialog();
      await fetchTestCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test user');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && testCustomers.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading test users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Test Users</h2>
          <p className="text-muted-foreground">
            Manage phone numbers used for test customer registration. Customers created with these
            numbers are marked as test users and can be hard-deleted.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTestCustomers} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Test User
              </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={handleAdd}>
                  <DialogHeader>
                    <DialogTitle>Add Test User</DialogTitle>
                    <DialogDescription>
                      Add a phone number to the test users registry. When a customer is created
                      with this phone number, they will be marked as a test user (is_test_user=true).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {addError && (
                      <Alert variant="destructive">
                        <AlertDescription>{addError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="add-name">Name</Label>
                      <Input
                        id="add-name"
                        placeholder="e.g. Test User 1"
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="add-phone">Phone Number</Label>
                      <Input
                        id="add-phone"
                        placeholder="e.g. 254711234567 or 0711234567"
                        value={addPhone}
                        onChange={(e) => setAddPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddDialogOpen(false)}
                      disabled={adding}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={adding}>
                      {adding ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Test Customer Phone Numbers</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} total` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testCustomers.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No test users found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Click &quot;Add Test User&quot; to register a phone number for test customer
                creation
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testCustomers.map((tc) => (
                    <TableRow key={tc.id}>
                      <TableCell className="font-medium">{tc.name}</TableCell>
                      <TableCell>{formatPhoneNumber(tc.phoneNumber)}</TableCell>
                      <TableCell>{formatDate(tc.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(tc)}
                          disabled={deletingId === tc.id}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {deletingId === tc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNextPage}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test User</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  Remove <strong>{deleteTarget.name}</strong> ({formatPhoneNumber(deleteTarget.phoneNumber)})
                  {' '}from the test users registry.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hard-delete"
                checked={hardDeleteChecked}
                onCheckedChange={(checked) => setHardDeleteChecked(checked === true)}
              />
              <Label
                htmlFor="hard-delete"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Also delete the customer record (hard delete)
              </Label>
            </div>

            {hardDeleteChecked && (
              <div className="min-h-[80px] space-y-4">
                {deletePreviewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for customer...
                  </div>
                ) : deletePreviewError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{deletePreviewError}</AlertDescription>
                  </Alert>
                ) : multipleCustomersError ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Multiple customers with that phone number exist. Cannot delete. Please resolve
                      the duplicate customers first.
                    </AlertDescription>
                  </Alert>
                ) : deletePreview?.totalCustomersWithPhone === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No customer record found with this phone number. Hard delete is not available.
                    Uncheck the box above to only remove from the test list.
                  </p>
                ) : deletePreview?.customersCount === 0 && deletePreview.totalCustomersWithPhone > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Customer record(s) exist with this phone number but none are marked as test user.
                    They may have been created before this phone was added to the test list. Hard
                    delete is not available. Uncheck the box above to only remove from the test list.
                  </p>
                ) : deletePreview?.customersCount === 1 && deletePreview.customer ? (
                  <div className="space-y-2">
                    <Label htmlFor="confirm-text">
                      Type exactly to confirm:
                    </Label>
                    <p className="font-mono text-sm font-medium">
                      {confirmationString}
                    </p>
                    <Input
                      id="confirm-text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type the text above exactly"
                      className="font-mono"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} disabled={!!deletingId}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete || !!deletingId || !!multipleCustomersError}
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
