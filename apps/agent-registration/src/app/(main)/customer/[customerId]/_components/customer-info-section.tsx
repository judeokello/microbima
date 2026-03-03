'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EditCustomerDialog from './edit-customer-dialog';

type CustomerStatusKey =
  | 'ACTIVE'
  | 'PENDING_ACTIVATION'
  | 'PENDING_KYC'
  | 'SUSPENDED'
  | 'DELETED'
  | 'TERMINATED'
  | 'KYC_VERIFIED';

function getCustomerStatusDisplay(status: string): { label: string; className: string } {
  const map: Record<CustomerStatusKey, { label: string; className: string }> = {
    ACTIVE: {
      label: 'Active',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    PENDING_ACTIVATION: {
      label: 'Pending Activation',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    PENDING_KYC: {
      label: 'KYC Pending',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    SUSPENDED: {
      label: 'Suspended',
      className: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    DELETED: {
      label: 'Deleted',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    TERMINATED: {
      label: 'Terminated',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    KYC_VERIFIED: {
      label: 'KYC Verified',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
  };
  const key = status as CustomerStatusKey;
  return (
    map[key] ?? {
      label: status,
      className: 'bg-muted text-muted-foreground border-border',
    }
  );
}

interface CustomerInfoSectionProps {
  customer: {
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    email?: string;
    phoneNumber?: string;
    gender?: string;
    idType: string;
    idNumber: string;
    createdAt: string;
    createdBy?: string;
    createdByDisplayName?: string;
    memberNumber?: string | null;
    memberNumberCreatedAt?: string | null;
    status?: string;
  };
  canEdit: boolean;
  onUpdate: () => void;
}

export default function CustomerInfoSection({ customer, canEdit, onUpdate }: CustomerInfoSectionProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatIdType = (idType: string) => {
    return idType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Information</CardTitle>
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditOpen(true)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">First Name</label>
              <p className="text-gray-900">{customer.firstName}</p>
            </div>
            {customer.middleName && (
              <div>
                <label className="text-sm font-medium text-gray-500">Middle Name</label>
                <p className="text-gray-900">{customer.middleName}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Last Name</label>
              <p className="text-gray-900">{customer.lastName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Date of Birth</label>
              <p className="text-gray-900">{formatDate(customer.dateOfBirth)}</p>
            </div>
            {customer.email && (
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900">{customer.email}</p>
              </div>
            )}
            {customer.phoneNumber && (
              <div>
                <label className="text-sm font-medium text-gray-500">Phone Number</label>
                <p className="text-gray-900">{customer.phoneNumber}</p>
              </div>
            )}
            {customer.gender && (
              <div>
                <label className="text-sm font-medium text-gray-500">Gender</label>
                <p className="text-gray-900 capitalize">{customer.gender}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">ID Type</label>
              <p className="text-gray-900">{formatIdType(customer.idType)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">ID Number</label>
              <p className="text-gray-900">{customer.idNumber}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Member Number</label>
              <p className="text-gray-900">{customer.memberNumber ?? 'Not assigned'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Created Date</label>
              <p className="text-gray-900">{formatDate(customer.createdAt)}</p>
            </div>
            {customer.createdBy && (
              <div>
                <label className="text-sm font-medium text-gray-500">Created By</label>
                <p className="text-gray-900">{customer.createdByDisplayName ?? customer.createdBy}</p>
              </div>
            )}
            {/* Spacer so Status appears in second column, below Created By */}
            <div />
            {customer.status != null && customer.status !== '' && (() => {
              const { label, className } = getCustomerStatusDisplay(customer.status);
              return (
                <div className="md:col-start-2">
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge variant="outline" className={className}>
                      {label}
                    </Badge>
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      <EditCustomerDialog
        customer={customer}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={onUpdate}
      />
    </>
  );
}
