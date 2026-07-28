'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, MoreHorizontal } from 'lucide-react';
import {
  activateCustomerPolicy,
  deactivateCustomerPolicy,
  getCustomerPoliciesList,
  resetCustomerPolicyStartDate,
  terminateCustomerPolicy,
  type CustomerPolicyListItem,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import * as Sentry from '@sentry/nextjs';
import PolicyReasonDialog from './policy-reason-dialog';
import ModifyProductDialog from './modify-product-dialog';
import ResetStartDateDialog from './reset-start-date-dialog';
import RemapPaymentsDialog from './remap-payments-dialog';
import DetachPaymentsDialog from './detach-payments-dialog';

const PAYMENTS_POLICY_STORAGE_KEY = (customerId: string) =>
  `customer-${customerId}-payments-policy`;

interface ProductsTabProps {
  customerId: string;
  /** 'admin' | 'dashboard' | 'agent' — used for policy detail link */
  basePath: 'admin' | 'dashboard' | 'agent';
}

type RowAction =
  | 'deactivate'
  | 'activate'
  | 'reset'
  | 'remap'
  | 'detach'
  | 'modify'
  | 'terminate'
  | null;

export default function ProductsTab({ customerId, basePath }: ProductsTabProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const showAdminActions = basePath === 'admin' && isAdmin;

  const [policies, setPolicies] = useState<CustomerPolicyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPolicy, setActionPolicy] = useState<CustomerPolicyListItem | null>(null);
  const [rowAction, setRowAction] = useState<RowAction>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      void loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCustomerPoliciesList(customerId);
      setPolicies(response.data);
    } catch (err) {
      console.error('Error loading products:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: { component: 'ProductsTab', action: 'load_products' },
          extra: { customerId },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (policyId: string) => {
    const prefix =
      basePath === 'agent' ? 'dashboard' : basePath;
    router.push(`/${prefix}/customer/${customerId}/policy/${policyId}`);
  };

  const openAction = (policy: CustomerPolicyListItem, action: RowAction) => {
    setActionPolicy(policy);
    setRowAction(action);
  };

  const closeAction = () => {
    setActionPolicy(null);
    setRowAction(null);
  };

  const onModifySuccess = (newPolicyId: string) => {
    sessionStorage.setItem(PAYMENTS_POLICY_STORAGE_KEY(customerId), newPolicyId);
    void loadProducts();
  };

  const canModify = (p: CustomerPolicyListItem) =>
    p.status === 'ACTIVE' ||
    p.status === 'PENDING_ACTIVATION' ||
    p.status === 'SUSPENDED';
  const canDeactivate = (p: CustomerPolicyListItem) =>
    p.status === 'ACTIVE' || p.status === 'SUSPENDED' || p.status === 'PENDING_ACTIVATION';
  const canActivate = (p: CustomerPolicyListItem) => p.status === 'SUSPENDED';
  const canReset = (p: CustomerPolicyListItem) =>
    p.status === 'ACTIVE' || p.status === 'SUSPENDED';
  const canRemap = (p: CustomerPolicyListItem) => p.status !== 'TERMINATED';
  const canDetach = (p: CustomerPolicyListItem) => p.status !== 'TERMINATED';
  const canTerminate = (p: CustomerPolicyListItem) =>
    p.status !== 'TERMINATED' && p.status !== 'DEACTIVATED';
  const hasRowActions = (p: CustomerPolicyListItem) =>
    canModify(p) ||
    canDeactivate(p) ||
    canActivate(p) ||
    canReset(p) ||
    canRemap(p) ||
    canDetach(p) ||
    canTerminate(p);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            Policies this customer is enrolled in. Click a row to view product and enrollment
            details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <p className="mb-4 text-sm text-green-700 dark:text-green-400">{successMessage}</p>
          )}
          {policies.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No products enrolled</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product / Package</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Underwriter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total premium</TableHead>
                    <TableHead className="text-right">Installment</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Missed</TableHead>
                    {showAdminActions && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell
                        className="font-medium cursor-pointer"
                        onClick={() => handleRowClick(p.id)}
                      >
                        {p.productName}
                        <span className="block text-xs text-muted-foreground">{p.packageName}</span>
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => handleRowClick(p.id)}>
                        {p.planName ?? '—'}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => handleRowClick(p.id)}>
                        {p.schemeName}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => handleRowClick(p.id)}>
                        {p.underwriterName ?? '—'}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => handleRowClick(p.id)}>
                        <Badge variant={p.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-right cursor-pointer"
                        onClick={() => handleRowClick(p.id)}
                      >
                        {p.totalPremium}
                      </TableCell>
                      <TableCell
                        className="text-right cursor-pointer"
                        onClick={() => handleRowClick(p.id)}
                      >
                        {p.installment}
                      </TableCell>
                      <TableCell
                        className="text-right cursor-pointer"
                        onClick={() => handleRowClick(p.id)}
                      >
                        {p.installmentsPaid}
                      </TableCell>
                      <TableCell
                        className="text-right cursor-pointer"
                        onClick={() => handleRowClick(p.id)}
                      >
                        {p.missedPayments}
                      </TableCell>
                      {showAdminActions && (
                        <TableCell>
                          {hasRowActions(p) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canModify(p) && (
                                  <DropdownMenuItem onClick={() => openAction(p, 'modify')}>
                                    Modify product
                                  </DropdownMenuItem>
                                )}
                                {canDeactivate(p) && (
                                  <DropdownMenuItem onClick={() => openAction(p, 'deactivate')}>
                                    Deactivate
                                  </DropdownMenuItem>
                                )}
                                {canActivate(p) && (
                                  <DropdownMenuItem onClick={() => openAction(p, 'activate')}>
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                {canReset(p) && (
                                  <DropdownMenuItem onClick={() => openAction(p, 'reset')}>
                                    Reset start date
                                  </DropdownMenuItem>
                                )}
                                {canRemap(p) && (
                                  <DropdownMenuItem onClick={() => openAction(p, 'remap')}>
                                    Remap payments
                                  </DropdownMenuItem>
                                )}
                                {canDetach(p) && (
                                  <DropdownMenuItem onClick={() => openAction(p, 'detach')}>
                                    Detach payments
                                  </DropdownMenuItem>
                                )}
                                {canTerminate(p) && (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => openAction(p, 'terminate')}
                                  >
                                    Terminate
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {actionPolicy && rowAction === 'modify' && (
        <ModifyProductDialog
          open
          onOpenChange={(o) => !o && closeAction()}
          customerId={customerId}
          policyId={actionPolicy.id}
          onSuccess={onModifySuccess}
        />
      )}

      {actionPolicy && rowAction === 'deactivate' && (
        <PolicyReasonDialog
          open
          onOpenChange={(o) => !o && closeAction()}
          title="Deactivate policy"
          description={`Deactivate ${actionPolicy.productName}. Customer status may change if this is their only active policy.`}
          confirmLabel="Deactivate"
          onSubmit={async (reason) => {
            await deactivateCustomerPolicy(customerId, actionPolicy.id, reason);
            await loadProducts();
          }}
        />
      )}

      {actionPolicy && rowAction === 'activate' && (
        <PolicyReasonDialog
          open
          onOpenChange={(o) => !o && closeAction()}
          title="Activate policy"
          description="Reactivate a suspended policy."
          confirmLabel="Activate"
          onSubmit={async (reason) => {
            await activateCustomerPolicy(customerId, actionPolicy.id, reason);
            await loadProducts();
          }}
        />
      )}

      {actionPolicy && rowAction === 'reset' && (
        <ResetStartDateDialog
          open
          onOpenChange={(o) => !o && closeAction()}
          onSubmit={async (reason, startDate) => {
            await resetCustomerPolicyStartDate(
              customerId,
              actionPolicy.id,
              reason,
              startDate
            );
            await loadProducts();
          }}
        />
      )}

      {actionPolicy && rowAction === 'remap' && (
        <RemapPaymentsDialog
          open
          onOpenChange={(o) => !o && closeAction()}
          customerId={customerId}
          policyId={actionPolicy.id}
          productName={actionPolicy.productName}
          onSuccess={(message) => {
            setSuccessMessage(message);
            void loadProducts();
          }}
        />
      )}

      {actionPolicy && rowAction === 'detach' && (
        <DetachPaymentsDialog
          open
          onOpenChange={(o) => !o && closeAction()}
          customerId={customerId}
          policyId={actionPolicy.id}
          productName={actionPolicy.productName}
          onSuccess={(message) => {
            setSuccessMessage(message);
            void loadProducts();
          }}
        />
      )}

      {actionPolicy && rowAction === 'terminate' && (
        <PolicyReasonDialog
          open
          onOpenChange={(o) => !o && closeAction()}
          title="Terminate policy"
          description={`Permanently terminate ${actionPolicy.productName}. The customer becomes Terminated only if they have no remaining Active, Pending, or Suspended policies.`}
          confirmLabel="Terminate"
          onSubmit={async (reason) => {
            await terminateCustomerPolicy(customerId, actionPolicy.id, reason);
            await loadProducts();
          }}
        />
      )}
    </>
  );
}

export { PAYMENTS_POLICY_STORAGE_KEY };
