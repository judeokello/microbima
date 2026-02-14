'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EditBeneficiaryDialog from './edit-beneficiary-dialog';
import AddBeneficiaryDialog from './add-beneficiary-dialog';
import { deleteBeneficiary } from '@/lib/api';

interface NextOfKinSectionProps {
  beneficiaries: Array<{
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    gender?: string;
    idType?: string | null;
    idNumber: string;
    deletedAt?: string | null;
    deletedBy?: string | null;
    deletedByDisplayName?: string | null;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeBeneficiaries = beneficiaries.filter((b) => !b.deletedAt);

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

  const formatIdType = (idType?: string | null) => {
    if (!idType) return 'N/A';
    return idType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatDeletedAt = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const handleDelete = async (beneficiaryId: string) => {
    setDeleteError(null);
    try {
      await deleteBeneficiary(customerId, beneficiaryId);
      setDeletingId(null);
      onUpdate();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const maxBeneficiaries = 1;
  const canAddMore = activeBeneficiaries.length < maxBeneficiaries;

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
            {beneficiaries.map((beneficiary) => {
              const isDeleted = !!beneficiary.deletedAt;
              return (
                <div
                  key={beneficiary.id}
                  className={`border rounded-lg p-4 flex items-start justify-between relative ${isDeleted ? 'bg-gray-50 opacity-75' : ''}`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                    {isDeleted && (
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center rounded-md bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                          Deleted
                        </span>
                      </div>
                    )}
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
                    {isDeleted && beneficiary.deletedByDisplayName && beneficiary.deletedAt && (
                      <div className="col-span-full mt-2 text-sm text-gray-500">
                        Deleted by {beneficiary.deletedByDisplayName} at {formatDeletedAt(beneficiary.deletedAt)}
                      </div>
                    )}
                  </div>
                  {!isDeleted && canEdit && (
                    <div className="flex gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(beneficiary.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(beneficiary.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
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

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete next of kin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the beneficiary as deleted. You can still see the record and who deleted it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-red-600">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
