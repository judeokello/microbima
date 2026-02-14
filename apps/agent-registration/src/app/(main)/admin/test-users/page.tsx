'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('Not authenticated');
    }
    return session.session.access_token;
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
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/test-customers?${params}`,
        {
          headers: {
            Authorization: `Bearer ${await getSupabaseToken()}`,
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        }
      );

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
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/test-customers`,
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

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/test-customers/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${await getSupabaseToken()}`,
            'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }

      await fetchTestCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test user');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && testCustomers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading test users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
                    Add a phone number to the test users registry. When a customer is created with
                    this phone number, they will be marked as a test user (is_test_user=true).
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
            <div className="text-center py-8">
              <p className="text-muted-foreground">No test users found</p>
              <p className="text-sm text-muted-foreground mt-2">
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
                          onClick={() => handleDelete(tc.id)}
                          disabled={deletingId === tc.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            <div className="flex items-center justify-between mt-4">
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
    </div>
  );
}
