'use client';

import { useState } from 'react';
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
import { updateBeneficiary, UpdateBeneficiaryData } from '@/lib/api';
import { useParams } from 'next/navigation';
import { formatPhoneNumber, getPhoneValidationError } from '@/lib/phone-validation';
import * as Sentry from '@sentry/nextjs';

interface EditBeneficiaryDialogProps {
  beneficiary: {
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    gender?: string;
    idType?: string | null;
    idNumber: string;
  };
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const mapIdTypeToBackend = (idType: string): string => {
  const mapping: Record<string, string> = {
    'NATIONAL_ID': 'national',
    'PASSPORT': 'passport',
    'ALIEN': 'alien',
    'BIRTH_CERTIFICATE': 'birth_certificate',
    'MILITARY': 'military',
  };
  return mapping[idType] ?? 'national';
};

const mapIdTypeFromBackend = (idType?: string | null): string => {
  if (!idType) return 'NATIONAL_ID';
  // Handle both lowercase DTO format and uppercase enum format
  const upperType = idType.toUpperCase();
  if (['NATIONAL_ID', 'PASSPORT', 'ALIEN', 'BIRTH_CERTIFICATE', 'MILITARY'].includes(upperType)) {
    return upperType;
  }
  const mapping: Record<string, string> = {
    'national': 'NATIONAL_ID',
    'passport': 'PASSPORT',
    'alien': 'ALIEN',
    'birth_certificate': 'BIRTH_CERTIFICATE',
    'military': 'MILITARY',
  };
  return mapping[idType.toLowerCase()] ?? 'NATIONAL_ID';
};

const mapGenderFromBackend = (gender?: string): string => {
  if (!gender) return '';
  // Handle both lowercase DTO format and uppercase enum format
  const lowerGender = gender.toLowerCase();
  if (lowerGender === 'male' || lowerGender === 'female') {
    return lowerGender;
  }
  return '';
};

export default function EditBeneficiaryDialog({
  beneficiary,
  customerId,
  open,
  onOpenChange,
  onSuccess,
}: EditBeneficiaryDialogProps) {
  const params = useParams();
  const actualCustomerId = customerId ?? (params.customerId as string);

  const [formData, setFormData] = useState<UpdateBeneficiaryData>({
    firstName: beneficiary.firstName,
    middleName: beneficiary.middleName,
    lastName: beneficiary.lastName,
    dateOfBirth: beneficiary.dateOfBirth,
    phoneNumber: beneficiary.phoneNumber,
    gender: mapGenderFromBackend(beneficiary.gender),
    idType: mapIdTypeFromBackend(beneficiary.idType),
    idNumber: beneficiary.idNumber,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPhoneError(null);

    // Validate phone number
    if (formData.phoneNumber) {
      const phoneErr = getPhoneValidationError(formData.phoneNumber);
      if (phoneErr) {
        setPhoneError(phoneErr);
        setLoading(false);
        return;
      }
    }

    try {
      const trimmedIdNumber = formData.idNumber?.trim() ?? '';
      const hasIdNumber = trimmedIdNumber.length > 0;

      const updateData: UpdateBeneficiaryData = {
        ...formData,
        idNumber: hasIdNumber ? trimmedIdNumber : undefined,
        idType: hasIdNumber ? mapIdTypeToBackend(formData.idType ?? 'NATIONAL_ID') : undefined,
      };

      await updateBeneficiary(actualCustomerId, beneficiary.id, updateData);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating beneficiary:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'EditBeneficiaryDialog',
            action: 'update_beneficiary',
          },
          extra: {
            beneficiaryId: beneficiary.id,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to update beneficiary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Next of Kin</DialogTitle>
          <DialogDescription>Update next of kin information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName ?? ''}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName ?? ''}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value || undefined })}
              />
            </div>

            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName ?? ''}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth ?? ''}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value || undefined })}
              />
            </div>

            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber ?? ''}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setFormData({ ...formData, phoneNumber: formatted || undefined });
                  setPhoneError(getPhoneValidationError(formatted));
                }}
                placeholder="01XXXXXXXX or 07XXXXXXXX"
              />
              {phoneError && (
                <p className="text-sm text-red-600 mt-1">{phoneError}</p>
              )}
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender ?? ''}
                onValueChange={(value) => setFormData({ ...formData, gender: value || undefined })}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder={formData.gender ? (formData.gender === 'male' ? 'Male' : 'Female') : 'Select gender'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="idType">ID Type</Label>
              <Select
                value={formData.idType ?? 'NATIONAL_ID'}
                onValueChange={(value) => setFormData({ ...formData, idType: value })}
              >
                <SelectTrigger id="idType">
                  <SelectValue placeholder="Select ID Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NATIONAL_ID">National ID</SelectItem>
                  <SelectItem value="PASSPORT">Passport</SelectItem>
                  <SelectItem value="ALIEN">Alien</SelectItem>
                  <SelectItem value="BIRTH_CERTIFICATE">Birth Certificate</SelectItem>
                  <SelectItem value="MILITARY">Military</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="idNumber">ID Number</Label>
              <Input
                id="idNumber"
                value={formData.idNumber ?? ''}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value || undefined })}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
