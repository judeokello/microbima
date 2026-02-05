'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EditDependantDialog from './edit-dependant-dialog';
import AddChildDialog from './add-child-dialog';

interface ChildrenSectionProps {
  dependants: Array<{
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    idType?: string;
    idNumber?: string;
    relationship: string;
    verificationRequired?: boolean;
    memberNumber?: string | null;
    memberNumberCreatedAt?: string | null;
  }>;
  canEdit: boolean;
  canAdd: boolean;
  onUpdate: () => void;
}

export default function ChildrenSection({ dependants, canEdit, canAdd, onUpdate }: ChildrenSectionProps) {
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

  const formatIdType = (idType?: string) => {
    if (!idType) return 'N/A';
    return idType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const maxChildren = 7;
  const canAddMore = dependants.length < maxChildren;

  if (dependants.length === 0) {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Children</CardTitle>
              {canAdd && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  disabled={!canAddMore}
                >
                  Add Child
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">No children added</p>
          </CardContent>
        </Card>
        <AddChildDialog
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
            <CardTitle>Children</CardTitle>
            {canAdd && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                disabled={!canAddMore}
              >
                Add Child
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dependants.map((dependant) => (
              <div
                key={dependant.id}
                className="border rounded-lg p-4 flex items-start justify-between relative"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  {dependant.verificationRequired && (
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
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(dependant.id)}
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

      <AddChildDialog
        customerId={customerId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={onUpdate}
      />
    </>
  );
}
