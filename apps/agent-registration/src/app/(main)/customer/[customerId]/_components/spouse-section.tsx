'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EditDependantDialog from './edit-dependant-dialog';
import AddSpouseDialog from './add-spouse-dialog';
import { deleteDependant } from '@/lib/api';

interface SpouseSectionProps {
  dependants: Array<{
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    idType?: string;
    idNumber?: string;
    relationship: string;
    verificationRequired?: boolean;
    memberNumber?: string | null;
    memberNumberCreatedAt?: string | null;
    deletedAt?: string | null;
    deletedBy?: string | null;
    deletedByDisplayName?: string | null;
  }>;
  canEdit: boolean;
  canAdd: boolean;
  onUpdate: () => void;
}

export default function SpouseSection({ dependants, canEdit, canAdd, onUpdate }: SpouseSectionProps) {
  const params = useParams();
  const customerId = params.customerId as string;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeDependants = dependants.filter((d) => !d.deletedAt);

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

  const formatIdType = (idType?: string) => {
    if (!idType) return 'N/A';
    return idType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const maxSpouses = 2;
  const canAddMore = activeDependants.length < maxSpouses;

  const handleDelete = async (dependantId: string) => {
    setDeleteError(null);
    try {
      await deleteDependant(dependantId);
      setDeletingId(null);
      onUpdate();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    }
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

  if (dependants.length === 0) {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Spouse</CardTitle>
              {canAdd && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  disabled={!canAddMore}
                >
                  Add Spouse
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">No spouse added</p>
          </CardContent>
        </Card>
        <AddSpouseDialog
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
            <CardTitle>Spouse</CardTitle>
            {canAdd && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                disabled={!canAddMore}
              >
                Add Spouse
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dependants.map((dependant) => {
              const isDeleted = !!dependant.deletedAt;
              return (
              <div
                key={dependant.id}
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
                  {dependant.verificationRequired && !isDeleted && (
                    <div className="absolute top-4 right-12">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Member verification is required</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">First Name</label>
                    <p className="text-gray-900">{dependant.firstName}</p>
                  </div>
                  {dependant.middleName && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Middle Name</label>
                      <p className="text-gray-900">{dependant.middleName}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Name</label>
                    <p className="text-gray-900">{dependant.lastName}</p>
                  </div>
                  {dependant.dateOfBirth && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                      <p className="text-gray-900">{formatDate(dependant.dateOfBirth)}</p>
                    </div>
                  )}
                  {dependant.phoneNumber && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone Number</label>
                      <p className="text-gray-900">{dependant.phoneNumber}</p>
                    </div>
                  )}
                  {dependant.idType && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">ID Type</label>
                      <p className="text-gray-900">{formatIdType(dependant.idType)}</p>
                    </div>
                  )}
                  {dependant.idNumber && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">ID Number</label>
                      <p className="text-gray-900">{dependant.idNumber}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Member Number</label>
                    <p className="text-gray-900">{dependant.memberNumber ?? 'Not assigned'}</p>
                  </div>
                  {isDeleted && dependant.deletedByDisplayName && dependant.deletedAt && (
                    <div className="col-span-full mt-2 text-sm text-gray-500">
                      Deleted by {dependant.deletedByDisplayName} at {formatDeletedAt(dependant.deletedAt)}
                    </div>
                  )}
                </div>
                {!isDeleted && canEdit && (
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(dependant.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(dependant.id)}
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
        <EditDependantDialog
          dependant={dependants.find((d) => d.id === editingId)!}
          open={!!editingId}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            onUpdate();
          }}
        />
      )}

      <AddSpouseDialog
        customerId={customerId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={onUpdate}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete spouse?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingId && dependants.find((d) => d.id === deletingId)?.memberNumber ? (
                <>
                  This spouse has a member number. Deleting will mark them as removed. This action can be viewed in the record history.
                </>
              ) : (
                <>This will mark the spouse as deleted. You can still see the record and who deleted it.</>
              )}
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
