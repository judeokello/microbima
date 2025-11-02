'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditCustomerDialog from './edit-customer-dialog';

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
              <label className="text-sm font-medium text-gray-500">Created Date</label>
              <p className="text-gray-900">{formatDate(customer.createdAt)}</p>
            </div>
            {customer.createdBy && (
              <div>
                <label className="text-sm font-medium text-gray-500">Created By</label>
                <p className="text-gray-900">{customer.createdBy}</p>
              </div>
            )}
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
