'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Edit, Save, X, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';
import { formatDate } from '@/lib/utils';
import { TruncatedDescription } from '../../../../[underwriterId]/_components/truncated-description';
import { validatePhoneNumber } from '@/lib/phone-validation';

interface Scheme {
  id: number;
  schemeName: string;
  description: string;
  isActive: boolean;
  isPostpaid: boolean;
  frequency?: string | null;
  paymentCadence?: number | null;
  paymentAcNumber?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SchemeContact {
  id: number;
  schemeId: number;
  firstName: string;
  otherName?: string | null;
  phoneNumber?: string | null;
  phoneNumber2?: string | null;
  email?: string | null;
  designation?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
}

interface Customer {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phoneNumber: string;
  gender: string;
  createdAt: string;
  idType: string;
  idNumber: string;
  hasMissingRequirements: boolean;
}

interface SchemeResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Scheme;
}

interface CustomersResponse {
  status: number;
  correlationId: string;
  message: string;
  data: Customer[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface UserDisplayNameResponse {
  status: number;
  correlationId: string;
  message: string;
  data: {
    userId: string;
    displayName: string;
    email: string;
  };
}

interface SchemeContactsResponse {
  status: number;
  correlationId: string;
  message: string;
  data: SchemeContact[];
}

interface PostpaidSchemePaymentItem {
  id: number;
  schemeId: number;
  amount: string;
  paymentType: string;
  transactionReference: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface PostpaidSchemePaymentsResponse {
  status: number;
  correlationId: string;
  message: string;
  data: PostpaidSchemePaymentItem[];
}

export default function SchemeDetailPage() {
  const params = useParams();
  const schemeId = parseInt(params.schemeId as string);

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<CustomersResponse['pagination'] | null>(null);
  const [createdByName, setCreatedByName] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    schemeName: '',
    description: '',
    isActive: true,
  });

  // Scheme contacts state
  const [contacts, setContacts] = useState<SchemeContact[]>([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<SchemeContact | null>(null);
  const [contactFormData, setContactFormData] = useState({
    firstName: '',
    otherName: '',
    phoneNumber: '',
    phoneNumber2: '',
    email: '',
    designation: '',
    notes: '',
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactDialogError, setContactDialogError] = useState<string | null>(null);

  // Scheme Payments (postpaid only)
  const [postpaidPayments, setPostpaidPayments] = useState<PostpaidSchemePaymentItem[]>([]);
  const [postpaidPaymentsLoading, setPostpaidPaymentsLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    paymentType: 'BANK_TRANSFER' as string,
    transactionReference: '',
    transactionDate: '',
  });
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchScheme = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SchemeResponse = await response.json();
      setScheme(data.data);
      setFormData({
        schemeName: data.data.schemeName,
        description: data.data.description,
        isActive: data.data.isActive,
      });

      // Fetch createdBy display name
      if (data.data.createdBy) {
        try {
          const userResponse = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/users/${data.data.createdBy}/display-name`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              'X-Source-Page': typeof window !== 'undefined' ? window.location.pathname : '',
            }
          });
          if (userResponse.ok) {
            const userData: UserDisplayNameResponse = await userResponse.json();
            setCreatedByName(userData.data.displayName);
          }
        } catch (err) {
          console.error('Error fetching user display name:', err);
          setCreatedByName('Unknown');
        }
      }
    } catch (err) {
      console.error('Error fetching scheme:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'SchemeDetailPage',
            action: 'fetch_scheme',
          },
          extra: {
            schemeId,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch scheme');
    } finally {
      setLoading(false);
    }
  }, [schemeId]);

  const fetchCustomers = useCallback(async () => {
    try {
      const token = await getSupabaseToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/customers?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CustomersResponse = await response.json();
      setCustomers(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }, [schemeId, currentPage, pageSize]);

  const fetchContacts = useCallback(async () => {
    try {
      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SchemeContactsResponse = await response.json();
      setContacts(data.data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }, [schemeId]);

  const fetchPostpaidPayments = useCallback(async () => {
    try {
      setPostpaidPaymentsLoading(true);
      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/postpaid-payments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: PostpaidSchemePaymentsResponse = await response.json();
      setPostpaidPayments(data.data);
    } catch (err) {
      console.error('Error fetching postpaid payments:', err);
    } finally {
      setPostpaidPaymentsLoading(false);
    }
  }, [schemeId]);

  useEffect(() => {
    fetchScheme();
    fetchContacts();
  }, [fetchScheme, fetchContacts]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (scheme?.isPostpaid) {
      fetchPostpaidPayments();
    }
  }, [scheme?.isPostpaid, fetchPostpaidPayments]);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`);
      }

      setEditing(false);
      fetchScheme();
    } catch (err) {
      console.error('Error updating scheme:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'SchemeDetailPage',
            action: 'update_scheme',
          },
          extra: {
            schemeId,
            formData,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to update scheme');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (scheme) {
      setFormData({
        schemeName: scheme.schemeName,
        description: scheme.description,
        isActive: scheme.isActive,
      });
    }
    setEditing(false);
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleOpenPaymentDialog = () => {
    setPaymentDialogOpen(true);
    setPaymentError(null);
    setValidationErrors(null);
    setPaymentFormData({ amount: '', paymentType: 'BANK_TRANSFER', transactionReference: '', transactionDate: '' });
    setPaymentFile(null);
  };

  const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPaymentFile(file ?? null);
    setValidationErrors(null);
  };

  const runValidatePayment = async () => {
    if (!paymentFile || !paymentFormData.amount.trim()) return;
    const amount = parseFloat(paymentFormData.amount);
    if (Number.isNaN(amount) || amount < 0) return;
    try {
      const token = await getSupabaseToken();
      const form = new FormData();
      form.append('file', paymentFile);
      form.append('amount', paymentFormData.amount);
      form.append('transactionReference', paymentFormData.transactionReference);
      const res = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/postpaid-payments/validate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (data.valid === false && data.errors?.length) {
        setValidationErrors(data.errors);
      } else {
        setValidationErrors(null);
      }
    } catch {
      setValidationErrors(['Validation request failed']);
    }
  };

  const handleSubmitPayment = async () => {
    if (!paymentFile || !paymentFormData.amount.trim() || !paymentFormData.transactionReference.trim() || !paymentFormData.transactionDate.trim()) {
      setPaymentError('Please fill all fields and upload a CSV file.');
      return;
    }
    const amount = parseFloat(paymentFormData.amount);
    if (Number.isNaN(amount) || amount < 0 || amount > 9999999.99) {
      setPaymentError('Amount must be between 0 and 9,999,999.99');
      return;
    }
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const token = await getSupabaseToken();
      const form = new FormData();
      form.append('file', paymentFile);
      form.append('amount', paymentFormData.amount);
      form.append('paymentType', paymentFormData.paymentType);
      form.append('transactionReference', paymentFormData.transactionReference);
      form.append('transactionDate', new Date(paymentFormData.transactionDate).toISOString());
      const res = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/postpaid-payments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message ?? errData.message ?? `HTTP ${res.status}`);
      }
      setPaymentDialogOpen(false);
      fetchPostpaidPayments();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to create payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleOpenContactDialog = (contact?: SchemeContact) => {
    if (contact) {
      setEditingContact(contact);
      setContactFormData({
        firstName: contact.firstName,
        otherName: contact.otherName ?? '',
        phoneNumber: contact.phoneNumber ?? '',
        phoneNumber2: contact.phoneNumber2 ?? '',
        email: contact.email ?? '',
        designation: contact.designation ?? '',
        notes: contact.notes ?? '',
      });
    } else {
      setEditingContact(null);
      setContactFormData({
        firstName: '',
        otherName: '',
        phoneNumber: '',
        phoneNumber2: '',
        email: '',
        designation: '',
        notes: '',
      });
    }
    setContactDialogOpen(true);
  };

  const handleCloseContactDialog = () => {
    setContactDialogOpen(false);
    setEditingContact(null);
    setContactDialogError(null);
    setContactFormData({
      firstName: '',
      otherName: '',
      phoneNumber: '',
      phoneNumber2: '',
      email: '',
      designation: '',
      notes: '',
    });
  };

  const handleSaveContact = async () => {
    // Clear previous errors
    setContactDialogError(null);

    // Validate required fields
    if (!contactFormData.firstName.trim()) {
      setContactDialogError('First name is required');
      return;
    }

    if (!contactFormData.phoneNumber.trim()) {
      setContactDialogError('Phone number is required');
      return;
    }

    if (!validatePhoneNumber(contactFormData.phoneNumber)) {
      setContactDialogError('Phone number must be 10 digits starting with 01 or 07');
      return;
    }

    // Validate phoneNumber2 if provided
    if (contactFormData.phoneNumber2 && !validatePhoneNumber(contactFormData.phoneNumber2)) {
      setContactDialogError('Alternate phone number must be 10 digits starting with 01 or 07');
      return;
    }

    // Check if we're at the 5 contact limit when adding a new contact
    if (!editingContact && contacts.length >= 5) {
      setContactDialogError('Maximum of 5 contacts allowed per scheme');
      return;
    }

    try {
      setContactLoading(true);
      setContactDialogError(null);

      const token = await getSupabaseToken();
      const url = editingContact
        ? `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/contacts/${editingContact.id}`
        : `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/contacts`;

      const response = await fetch(url, {
        method: editingContact ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify(contactFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Extract validation errors if present
        let errorMessage = errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`;
        if (errorData.error?.details) {
          // Handle multiple field errors
          const details = errorData.error.details;
          if (typeof details === 'object') {
            const fieldErrors = Object.entries(details)
              .map(([field, message]) => `${field}: ${message}`)
              .join('\n');
            errorMessage = fieldErrors ?? errorMessage;
          } else {
            errorMessage = details ?? errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      handleCloseContactDialog();
      fetchContacts();
    } catch (err) {
      console.error('Error saving contact:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'SchemeDetailPage',
            action: 'save_contact',
          },
          extra: {
            schemeId,
            contactFormData,
          },
        });
      }
      setContactDialogError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setContactLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      setError(null);

      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/schemes/${schemeId}/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message ?? `HTTP ${response.status}: ${response.statusText}`);
      }

      fetchContacts();
    } catch (err) {
      console.error('Error deleting contact:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'SchemeDetailPage',
            action: 'delete_contact',
          },
          extra: {
            schemeId,
            contactId,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const getGenderBadgeVariant = (gender: string) => {
    switch (gender.toLowerCase()) {
      case 'male':
        return 'default';
      case 'female':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getMissingDataIcon = (hasMissingRequirements: boolean) => {
    return hasMissingRequirements ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <CheckCircle className="h-4 w-4 text-green-500" />
    );
  };

  if (loading && !scheme) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading scheme...</span>
      </div>
    );
  }

  if (error && !scheme) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!scheme) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheme Details</h1>
          <p className="text-muted-foreground mt-2">
            View and manage scheme information
          </p>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Scheme Details */}
      <Card>
        <CardHeader>
          <CardTitle>Scheme Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Scheme Name</Label>
              {editing ? (
                <Input
                  value={formData.schemeName}
                  onChange={(e) => setFormData({ ...formData, schemeName: e.target.value })}
                  required
                />
              ) : (
                <p className="text-sm font-medium">{scheme.schemeName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="schemeStatus">Status</Label>
              {editing ? (
                <select
                  id="schemeStatus"
                  aria-label="Scheme status"
                  value={formData.isActive ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant={scheme.isActive ? 'default' : 'secondary'}>
                    {scheme.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {scheme.isPostpaid && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      Postpaid
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="schemeDescription">Description</Label>
              {editing ? (
                <textarea
                  id="schemeDescription"
                  aria-label="Scheme description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  required
                />
              ) : (
                <div className="flex items-start gap-2">
                  <TruncatedDescription
                    description={scheme.description.length > 40 ? scheme.description.substring(0, 40) + '...' : scheme.description}
                    fullDescription={scheme.description}
                  />
                </div>
              )}
            </div>

            {scheme.isPostpaid && (
              <>
                <div>
                  <Label>Payment Frequency</Label>
                  <p className="text-sm font-medium">
                    {scheme.frequency ?
                      scheme.frequency === 'CUSTOM'
                        ? `Custom (${scheme.paymentCadence} days)`
                        : `${scheme.frequency.charAt(0) + scheme.frequency.slice(1).toLowerCase()} (${scheme.paymentCadence} days)`
                      : 'Not set'}
                  </p>
                </div>

                <div>
                  <Label>Payment Account Number</Label>
                  <p className="text-sm font-medium">{scheme.paymentAcNumber ?? 'Not generated'}</p>
                </div>
              </>
            )}

            <div>
              <Label>Created At</Label>
              <p className="text-sm font-medium">{formatDate(scheme.createdAt)}</p>
            </div>

            <div>
              <Label>Created By</Label>
              <p className="text-sm font-medium">{createdByName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} total customers` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No customers found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>ID Type</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Data Complete?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => window.open(`/dashboard/customer/${customer.id}`, '_blank')}
                      >
                        <TableCell className="font-medium">
                          <span className="text-blue-600 hover:underline">
                            {[customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          {customer.phoneNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getGenderBadgeVariant(customer.gender)}>
                            {customer.gender}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(customer.createdAt)}
                        </TableCell>
                        <TableCell>
                          {customer.idType}
                        </TableCell>
                        <TableCell>
                          {customer.idNumber}
                        </TableCell>
                        <TableCell>
                          {getMissingDataIcon(customer.hasMissingRequirements)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                    {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of{' '}
                    {pagination.totalItems} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      aria-label="Page size"
                      value={pageSize.toString()}
                      onChange={(e) => handlePageSizeChange(e.target.value)}
                      className="px-3 py-1 border rounded-md text-sm"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="30">30</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPreviousPage}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Scheme Payments (postpaid only) */}
      {scheme?.isPostpaid && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scheme Payments</CardTitle>
                <CardDescription>
                  Upload postpaid payment batches (CSV). Columns: Name, phone number, amount, id number, paid date (optional).
                </CardDescription>
              </div>
              <Button onClick={handleOpenPaymentDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Payment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {postpaidPaymentsLoading ? (
              <div className="text-center py-6 text-muted-foreground">Loading payments...</div>
            ) : postpaidPayments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No payments yet</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment type</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postpaidPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.transactionReference}</TableCell>
                        <TableCell>{p.amount}</TableCell>
                        <TableCell>{p.paymentType}</TableCell>
                        <TableCell>{formatDate(p.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scheme Contacts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheme Contacts</CardTitle>
              <CardDescription>
                Manage contact persons for this scheme (Maximum 5 contacts)
              </CardDescription>
            </div>
            <Button
              onClick={() => handleOpenContactDialog()}
              disabled={contacts.length >= 5}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No contacts found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {[contact.firstName, contact.otherName].filter(Boolean).join(' ')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {contact.phoneNumber && <span>{contact.phoneNumber}</span>}
                          {contact.phoneNumber2 && <span className="text-sm text-muted-foreground">{contact.phoneNumber2}</span>}
                        </div>
                      </TableCell>
                      <TableCell>{contact.email ?? '-'}</TableCell>
                      <TableCell>{contact.designation ?? '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenContactDialog(contact)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteContact(contact.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
            <DialogDescription>
              {editingContact ? 'Update the contact information.' : 'Add a new contact person for this scheme.'}
            </DialogDescription>
          </DialogHeader>

          {contactDialogError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm whitespace-pre-line">
              {contactDialogError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label>First Name *</Label>
              <Input
                value={contactFormData.firstName}
                onChange={(e) => {
                  setContactFormData({ ...contactFormData, firstName: e.target.value });
                  // Clear error when user starts typing
                  if (contactDialogError) setContactDialogError(null);
                }}
                placeholder="Enter first name"
                maxLength={50}
                required
              />
            </div>

            <div>
              <Label>Other Name</Label>
              <Input
                value={contactFormData.otherName}
                onChange={(e) => setContactFormData({ ...contactFormData, otherName: e.target.value })}
                placeholder="Enter other names"
                maxLength={50}
              />
            </div>

            <div>
              <Label>Phone Number *</Label>
              <Input
                value={contactFormData.phoneNumber}
                onChange={(e) => {
                  setContactFormData({ ...contactFormData, phoneNumber: e.target.value });
                  // Clear error when user starts typing
                  if (contactDialogError) setContactDialogError(null);
                }}
                placeholder="Enter phone number (e.g., 0712345678)"
                maxLength={15}
                required
              />
            </div>

            <div>
              <Label>Alternate Phone Number</Label>
              <Input
                value={contactFormData.phoneNumber2}
                onChange={(e) => {
                  setContactFormData({ ...contactFormData, phoneNumber2: e.target.value });
                  // Clear error when user starts typing
                  if (contactDialogError) setContactDialogError(null);
                }}
                placeholder="Enter alternate phone (e.g., 0123456789)"
                maxLength={15}
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={contactFormData.email}
                onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                placeholder="Enter email address"
                maxLength={100}
              />
            </div>

            <div>
              <Label>Designation</Label>
              <Input
                value={contactFormData.designation}
                onChange={(e) => setContactFormData({ ...contactFormData, designation: e.target.value })}
                placeholder="Enter designation/title"
                maxLength={100}
              />
            </div>

            <div>
              <Label>Notes</Label>
              <textarea
                value={contactFormData.notes}
                onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                placeholder="Enter any additional notes"
                className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseContactDialog} disabled={contactLoading}>
              Cancel
            </Button>
            <Button onClick={handleSaveContact} disabled={contactLoading}>
              {contactLoading ? 'Saving...' : 'Save Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Postpaid Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add payment</DialogTitle>
            <DialogDescription>
              Upload a CSV and enter batch details. CSV columns: Name, phone number, amount, id number, paid date (optional). Total amount must match the sum of CSV amounts.
            </DialogDescription>
          </DialogHeader>
          {paymentError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm whitespace-pre-line">
              {paymentError}
            </div>
          )}
          {validationErrors && validationErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm">
              <p className="font-medium mb-1">Validation issues:</p>
              <ul className="list-disc list-inside">
                {validationErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label>CSV file *</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handlePaymentFileChange}
              />
            </div>
            <div>
              <Label>Total amount (KES) *</Label>
              <Input
                type="number"
                min={0}
                max={9999999.99}
                step={0.01}
                value={paymentFormData.amount}
                onChange={(e) => {
                  setPaymentFormData({ ...paymentFormData, amount: e.target.value });
                  setValidationErrors(null);
                }}
                placeholder="Must match sum of CSV amounts"
              />
            </div>
            <div>
              <Label>Payment type *</Label>
              <select
                className="w-full h-10 px-3 border rounded-md"
                value={paymentFormData.paymentType}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentType: e.target.value })}
              >
                <option value="MPESA">MPESA</option>
                <option value="SASAPAY">SasaPay</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <Label>Transaction reference * (max 35 characters)</Label>
              <Input
                value={paymentFormData.transactionReference}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, transactionReference: e.target.value.slice(0, 35) })}
                placeholder="e.g. BATCH-JAN-2025-001"
                maxLength={35}
              />
            </div>
            <div>
              <Label>Payment made date * (e.g. cheque date or bank transfer date)</Label>
              <Input
                type="date"
                value={paymentFormData.transactionDate}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, transactionDate: e.target.value })}
              />
            </div>
            <Button variant="outline" size="sm" onClick={runValidatePayment} disabled={!paymentFile || !paymentFormData.amount.trim()}>
              Validate CSV
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={paymentLoading}>
              Cancel
            </Button>
            <Button onClick={handleSubmitPayment} disabled={paymentLoading || !paymentFile}>
              {paymentLoading ? 'Submitting...' : 'Submit payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

