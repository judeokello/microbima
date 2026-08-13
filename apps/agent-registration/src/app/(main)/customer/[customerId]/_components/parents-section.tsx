'use client';

import { useMemo, useState } from 'react';
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
import { deleteParent, ParentRelationship } from '@/lib/api';
import AddParentDialog from './add-parent-dialog';
import EditParentDialog from './edit-parent-dialog';

interface ParentRow {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  idType?: string;
  idNumber?: string;
  relationship: ParentRelationship;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedByDisplayName?: string | null;
}

interface ParentsSectionProps {
  parents: ParentRow[];
  canEdit: boolean;
  canAdd: boolean;
  onUpdate: () => void;
}

const RELATIONSHIP_LABELS: Record<ParentRelationship, string> = {
  MOTHER: 'Mother',
  FATHER: 'Father',
  MOTHER_IN_LAW: 'Mother-in-Law',
  FATHER_IN_LAW: 'Father-in-Law',
};

export default function ParentsSection({
  parents,
  canEdit,
  canAdd,
  onUpdate,
}: ParentsSectionProps) {
  const params = useParams();
  const customerId = params.customerId as string;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeParents = parents.filter((p) => !p.deletedAt);
  const maxParents = 4;
  const canAddMore = activeParents.length < maxParents;

  const relationshipUsage = useMemo(() => {
    const usage: Record<ParentRelationship, number> = {
      MOTHER: 0,
      FATHER: 0,
      MOTHER_IN_LAW: 0,
      FATHER_IN_LAW: 0,
    };
    for (const parent of activeParents) {
      usage[parent.relationship] += 1;
    }
    return usage;
  }, [activeParents]);

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

  const handleDelete = async (parentId: string) => {
    setDeleteError(null);
    try {
      await deleteParent(parentId);
      setDeletingId(null);
      onUpdate();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Parents</CardTitle>
            {canAdd && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                disabled={!canAddMore}
              >
                Add Parent
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {parents.length === 0 ? (
            <p className="text-gray-500">No parents added</p>
          ) : (
            <div className="space-y-4">
              {parents.map((parent) => {
                const isDeleted = !!parent.deletedAt;
                return (
                  <div
                    key={parent.id}
                    className={`border rounded-lg p-4 flex items-start justify-between relative ${
                      isDeleted ? 'bg-gray-50 opacity-75' : ''
                    }`}
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
                        <p className="text-gray-900">{parent.firstName}</p>
                      </div>
                      {parent.middleName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Middle Name</label>
                          <p className="text-gray-900">{parent.middleName}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-500">Last Name</label>
                        <p className="text-gray-900">{parent.lastName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                        <p className="text-gray-900">{formatDate(parent.dateOfBirth)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Gender</label>
                        <p className="text-gray-900">
                          {parent.gender
                            ? parent.gender.charAt(0).toUpperCase() + parent.gender.slice(1).toLowerCase()
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Relationship</label>
                        <p className="text-gray-900">
                          {RELATIONSHIP_LABELS[parent.relationship] ?? parent.relationship}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">ID Type</label>
                        <p className="text-gray-900">{formatIdType(parent.idType)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">ID Number</label>
                        <p className="text-gray-900">{parent.idNumber ?? 'N/A'}</p>
                      </div>
                      {isDeleted && parent.deletedByDisplayName && parent.deletedAt && (
                        <div className="col-span-full mt-2 text-sm text-gray-500">
                          Deleted by {parent.deletedByDisplayName} at{' '}
                          {formatDeletedAt(parent.deletedAt)}
                        </div>
                      )}
                    </div>
                    {!isDeleted && canEdit && (
                      <div className="flex gap-1 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(parent.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(parent.id)}
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
          )}
        </CardContent>
      </Card>

      {editingId && (
        <EditParentDialog
          parent={parents.find((p) => p.id === editingId)!}
          open={!!editingId}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            onUpdate();
          }}
          relationshipUsage={relationshipUsage}
        />
      )}

      <AddParentDialog
        customerId={customerId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={onUpdate}
        relationshipUsage={relationshipUsage}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete parent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the parent as deleted. You can still see the record and who deleted it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
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
