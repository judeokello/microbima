'use client';

import { useMemo, useState } from 'react';
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
import { addParents, ParentRelationship } from '@/lib/api';
import { getIdNumberValidationError, ID_NUMBER_MAX_LENGTH } from '@/lib/id-number-validation';
import DateOfBirthInput from '@/components/date-of-birth-input';
import * as Sentry from '@sentry/nextjs';

const PARENT_RELATIONSHIP_OPTIONS: Array<{ value: ParentRelationship; label: string }> = [
  { value: 'MOTHER', label: 'Mother' },
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER_IN_LAW', label: 'Mother-in-Law' },
  { value: 'FATHER_IN_LAW', label: 'Father-in-Law' },
];

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

interface AddParentDialogProps {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  relationshipUsage: Record<ParentRelationship, number>;
}

export default function AddParentDialog({
  customerId,
  open,
  onOpenChange,
  onSuccess,
  relationshipUsage,
}: AddParentDialogProps) {
  const maxDateAdults = useMemo(() => getMaxDateAdults(), []);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    idType: 'NATIONAL_ID',
    idNumber: '',
    relationship: '' as ParentRelationship | '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      idType: 'NATIONAL_ID',
      idNumber: '',
      relationship: '',
    });
    setError(null);
  };

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

    if ((relationshipUsage[formData.relationship] ?? 0) >= 2) {
      setError(`Relationship ${formData.relationship} can be used at most twice`);
      setLoading(false);
      return;
    }

    try {
      const result = await addParents(customerId, [
        {
          firstName: formData.firstName.trim(),
          middleName: formData.middleName.trim() || undefined,
          lastName: formData.lastName.trim(),
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender.toLowerCase(),
          idType: mapIdTypeToBackend(formData.idType),
          idNumber: formData.idNumber.trim(),
          relationship: formData.relationship,
        },
      ]);

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to add parent');
      }

      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error adding parent:', err);
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: { component: 'AddParentDialog', action: 'add_parent' },
          extra: { customerId },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to add parent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Parent</DialogTitle>
          <DialogDescription>Add parent or parent-in-law details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="parentFirstName">First Name *</Label>
              <Input
                id="parentFirstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="parentMiddleName">Middle Name</Label>
              <Input
                id="parentMiddleName"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="parentLastName">Last Name *</Label>
              <Input
                id="parentLastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Date of Birth *</Label>
              <DateOfBirthInput
                id="parentDateOfBirth"
                value={formData.dateOfBirth}
                onChange={(value) => setFormData({ ...formData, dateOfBirth: value })}
                maxDate={maxDateAdults}
                required
              />
            </div>
            <div>
              <Label htmlFor="parentGender">Gender *</Label>
              <Select
                value={formData.gender || undefined}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger id="parentGender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="parentRelationship">Relationship *</Label>
              <Select
                value={formData.relationship || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, relationship: value as ParentRelationship })
                }
              >
                <SelectTrigger id="parentRelationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {PARENT_RELATIONSHIP_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={(relationshipUsage[option.value] ?? 0) >= 2}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="parentIdType">ID Type *</Label>
              <Select
                value={formData.idType}
                onValueChange={(value) => setFormData({ ...formData, idType: value })}
              >
                <SelectTrigger id="parentIdType">
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
              <Label htmlFor="parentIdNumber">ID Number *</Label>
              <Input
                id="parentIdNumber"
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
              Add Parent
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
