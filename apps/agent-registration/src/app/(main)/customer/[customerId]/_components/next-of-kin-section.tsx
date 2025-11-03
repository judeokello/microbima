'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditBeneficiaryDialog from './edit-beneficiary-dialog';
import AddBeneficiaryDialog from './add-beneficiary-dialog';

interface NextOfKinSectionProps {
  beneficiaries: Array<{
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    gender?: string;
    idType: string;
    idNumber: string;
  }>;
  canEdit: boolean;
  canAdd: boolean;
  onUpdate: () => void;
}

export default function NextOfKinSection({ beneficiaries, canEdit, canAdd, onUpdate }: NextOfKinSectionProps) {
  const params = useParams();
  const customerId = params.customerId as string;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
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

  const maxBeneficiaries = 1;
  const canAddMore = beneficiaries.length < maxBeneficiaries;

  if (beneficiaries.length === 0) {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Next of Kin</CardTitle>
              {canAdd && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  disabled={!canAddMore}
                >
                  Add Next of Kin
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">No next of kin added</p>
          </CardContent>
        </Card>
        <AddBeneficiaryDialog
          customerId={customerId}
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          onSuccess={onUpdate}
        />
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Next of Kin</CardTitle>
            {canAdd && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                disabled={!canAddMore}
              >
                Add Next of Kin
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {beneficiaries.map((beneficiary) => (
              <div
                key={beneficiary.id}
                className="border rounded-lg p-4 flex items-start justify-between"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  <div>
                    <label className="text-sm font-medium text-gray-500">First Name</label>
                    <p className="text-gray-900">{beneficiary.firstName}</p>
                  </div>
                  {beneficiary.middleName && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Middle Name</label>
                      <p className="text-gray-900">{beneficiary.middleName}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Name</label>
                    <p className="text-gray-900">{beneficiary.lastName}</p>
                  </div>
                  {beneficiary.dateOfBirth && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                      <p className="text-gray-900">{formatDate(beneficiary.dateOfBirth)}</p>
                    </div>
                  )}
                  {beneficiary.phoneNumber && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone Number</label>
                      <p className="text-gray-900">{beneficiary.phoneNumber}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID Type</label>
                    <p className="text-gray-900">{formatIdType(beneficiary.idType)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID Number</label>
                    <p className="text-gray-900">{beneficiary.idNumber}</p>
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(beneficiary.id)}
                    className="h-8 w-8 p-0 ml-4"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {editingId && (
        <EditBeneficiaryDialog
          beneficiary={beneficiaries.find((b) => b.id === editingId)!}
          customerId={customerId}
          open={!!editingId}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            onUpdate();
          }}
        />
      )}

      <AddBeneficiaryDialog
        customerId={customerId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={onUpdate}
      />
    </>
  );
}
