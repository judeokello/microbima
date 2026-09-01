'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { ParentRelationship, updateParent } from '@/lib/api';
import { getIdNumberValidationError, ID_NUMBER_MAX_LENGTH } from '@/lib/id-number-validation';
import DateOfBirthInput from '@/components/date-of-birth-input';
import { useRevealedIdForEdit } from '@/components/view-id-number/use-revealed-id-for-edit';
import * as Sentry from '@sentry/nextjs';
import { useParams } from 'next/navigation';

const PARENT_RELATIONSHIP_OPTIONS: Array<{ value: ParentRelationship; label: string }> = [
  { value: 'MOTHER', label: 'Mother' },
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER_IN_LAW', label: 'Mother-in-Law' },
  { value: 'FATHER_IN_LAW', label: 'Father-in-Law' },
];

const mapIdTypeFromBackend = (idType?: string): string => {
  const mapping: Record<string, string> = {
    national: 'NATIONAL_ID',
    passport: 'PASSPORT',
    alien: 'ALIEN',
    birth_certificate: 'BIRTH_CERTIFICATE',
    military: 'MILITARY',
    NATIONAL_ID: 'NATIONAL_ID',
    PASSPORT: 'PASSPORT',
    ALIEN: 'ALIEN',
    BIRTH_CERTIFICATE: 'BIRTH_CERTIFICATE',
    MILITARY: 'MILITARY',
  };
  return mapping[idType ?? ''] ?? 'NATIONAL_ID';
};

const mapIdTypeToBackend = (idType: string): string => {
  const mapping: Record<string, string> = {
    NATIONAL_ID: 'national',
    PASSPORT: 'passport',
    ALIEN: 'alien',
    BIRTH_CERTIFICATE: 'birth_certificate',
    MILITARY: 'military',
  };
  return mapping[idType] ?? 'national';
};

function getMaxDateAdults(): string {
  const today = new Date();
  const year = today.getFullYear() - 18;
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface EditParentDialogProps {
  parent: {
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    idType?: string;
    idNumber?: string;
    relationship: ParentRelationship;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  relationshipUsage: Record<ParentRelationship, number>;
}

export default function EditParentDialog({
  parent,
  open,
  onOpenChange,
  onSuccess,
  relationshipUsage,
}: EditParentDialogProps) {
  const params = useParams();
  const customerId = params.customerId as string;
  const maxDateAdults = useMemo(() => getMaxDateAdults(), []);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    idType: 'NATIONAL_ID',
    idNumber: '',
    relationship: 'MOTHER' as ParentRelationship,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revealedIdNumber = useRevealedIdForEdit({
    open,
    customerId,
    entityKind: 'PARENT',
    entityId: parent.id,
    maskedValue: parent.idNumber,
  });

  useEffect(() => {
    if (!open) return;
    setFormData({
      firstName: parent.firstName,
      middleName: parent.middleName ?? '',
      lastName: parent.lastName,
      dateOfBirth: parent.dateOfBirth ?? '',
      gender: (parent.gender ?? '').toUpperCase(),
      idType: mapIdTypeFromBackend(parent.idType),
      idNumber:
        revealedIdNumber && !revealedIdNumber.includes('*')
          ? revealedIdNumber
          : (parent.idNumber ?? ''),
      relationship: parent.relationship,
    });
    setError(null);
  }, [open, parent, revealedIdNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.dateOfBirth ||
      !formData.gender ||
      !formData.relationship ||
      !formData.idNumber.trim()
    ) {
      setError('First name, last name, date of birth, gender, relationship, and ID number are required');
      setLoading(false);
      return;
    }

    const idError = getIdNumberValidationError(formData.idNumber, true);
    if (idError) {
      setError(idError);
      setLoading(false);
      return;
    }

    const usageWithoutSelf =
      (relationshipUsage[formData.relationship] ?? 0) -
      (formData.relationship === parent.relationship ? 1 : 0);
    if (usageWithoutSelf >= 2) {
      setError(`Relationship ${formData.relationship} can be used at most twice`);
      setLoading(false);
      return;
    }

    try {
      await updateParent(parent.id, {
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim() || undefined,
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender.toLowerCase(),
        idType: mapIdTypeToBackend(formData.idType),
        idNumber: formData.idNumber.trim(),
        relationship: formData.relationship,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating parent:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: { component: 'EditParentDialog', action: 'update_parent' },
          extra: { parentId: parent.id },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to update parent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Parent</DialogTitle>
          <DialogDescription>Update parent or parent-in-law details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="editParentFirstName">First Name *</Label>
              <Input
                id="editParentFirstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="editParentMiddleName">Middle Name</Label>
              <Input
                id="editParentMiddleName"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="editParentLastName">Last Name *</Label>
              <Input
                id="editParentLastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Date of Birth *</Label>
              <DateOfBirthInput
                id="editParentDateOfBirth"
                value={formData.dateOfBirth}
                onChange={(value) => setFormData({ ...formData, dateOfBirth: value })}
                maxDate={maxDateAdults}
                required
              />
            </div>
            <div>
              <Label htmlFor="editParentGender">Gender *</Label>
              <Select
                value={formData.gender || undefined}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger id="editParentGender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editParentRelationship">Relationship *</Label>
              <Select
                value={formData.relationship}
                onValueChange={(value) =>
                  setFormData({ ...formData, relationship: value as ParentRelationship })
                }
              >
                <SelectTrigger id="editParentRelationship">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARENT_RELATIONSHIP_OPTIONS.map((option) => {
                    const usageWithoutSelf =
                      (relationshipUsage[option.value] ?? 0) -
                      (option.value === parent.relationship ? 1 : 0);
                    return (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        disabled={usageWithoutSelf >= 2}
                      >
                        {option.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editParentIdType">ID Type *</Label>
              <Select
                value={formData.idType}
                onValueChange={(value) => setFormData({ ...formData, idType: value })}
              >
                <SelectTrigger id="editParentIdType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NATIONAL_ID">National ID</SelectItem>
                  <SelectItem value="PASSPORT">Passport</SelectItem>
                  <SelectItem value="ALIEN">Alien ID</SelectItem>
                  <SelectItem value="BIRTH_CERTIFICATE">Birth Certificate</SelectItem>
                  <SelectItem value="MILITARY">Military ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editParentIdNumber">ID Number *</Label>
              <Input
                id="editParentIdNumber"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                maxLength={ID_NUMBER_MAX_LENGTH}
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
