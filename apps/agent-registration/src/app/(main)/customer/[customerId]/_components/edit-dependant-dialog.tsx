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
import { updateDependant, UpdateDependantData } from '@/lib/api';
import { formatPhoneNumber, getPhoneValidationError } from '@/lib/phone-validation';
import * as Sentry from '@sentry/nextjs';

interface EditDependantDialogProps {
  dependant: {
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    gender?: string;
    idType?: string;
    idNumber?: string;
    relationship?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const mapIdTypeToBackend = (idType?: string): string | undefined => {
  if (!idType) return undefined;
  const mapping: Record<string, string> = {
    'NATIONAL_ID': 'national',
    'PASSPORT': 'passport',
    'ALIEN': 'alien',
    'BIRTH_CERTIFICATE': 'birth_certificate',
    'MILITARY': 'military',
  };
  return mapping[idType] ?? undefined;
};

const mapIdTypeFromBackend = (idType?: string): string => {
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

// Get minimum date for adults (18 years ago from today)
const getMinDateForAdults = () => {
  const today = new Date();
  const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return minDate.toISOString().split('T')[0];
};

// Get maximum date for children (today)
const getMaxDateForChildren = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Get minimum date for children (24 years ago from today)
const getMinDateForChildren = () => {
  const today = new Date();
  const minDate = new Date(today.getFullYear() - 24, today.getMonth(), today.getDate());
  return minDate.toISOString().split('T')[0];
};

// Calculate age from date of birth
const calculateAge = (dateOfBirth: string): number => {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function EditDependantDialog({
  dependant,
  open,
  onOpenChange,
  onSuccess,
}: EditDependantDialogProps) {
  const [formData, setFormData] = useState<UpdateDependantData>({
    firstName: dependant.firstName,
    middleName: dependant.middleName,
    lastName: dependant.lastName,
    dateOfBirth: dependant.dateOfBirth,
    phoneNumber: dependant.phoneNumber,
    gender: mapGenderFromBackend(dependant.gender),
    idType: mapIdTypeFromBackend(dependant.idType),
    idNumber: dependant.idNumber,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhoneError(null);

    // Validate phone number
    if (formData.phoneNumber) {
      const phoneErr = getPhoneValidationError(formData.phoneNumber);
      if (phoneErr) {
        setPhoneError(phoneErr);
        return;
      }
    }

    // Determine if this is a spouse or child
    const isSpouse = dependant.relationship === 'SPOUSE' || dependant.relationship === 'spouse';
    const isChild = dependant.relationship === 'CHILD' || dependant.relationship === 'child';

    // Validate date of birth
    if (formData.dateOfBirth) {
      const selectedDate = new Date(formData.dateOfBirth);
      const today = new Date();
      if (selectedDate > today) {
        setError('Date of birth cannot be in the future');
        try {
          Sentry.captureException(new Error('Date of birth validation failed'), {
            tags: {
              component: 'EditDependantDialog',
              action: 'validation_error',
            },
            extra: {
              dependantId: dependant.id,
              relationship: dependant.relationship,
              field: 'dateOfBirth',
              value: formData.dateOfBirth,
              errorMessage: 'Date of birth cannot be in the future',
            },
          });
        } catch (sentryErr) {
          console.error('Sentry error:', sentryErr);
        }
        return;
      }

      if (isSpouse) {
        // Validate spouse is at least 18 years old
        const age = calculateAge(formData.dateOfBirth);
        if (age < 18) {
          setError('Minimum age is 18 years old for a spouse');
          try {
            Sentry.captureException(new Error('Age validation failed'), {
              tags: {
                component: 'EditDependantDialog',
                action: 'age_validation_error',
              },
              extra: {
                dependantId: dependant.id,
                relationship: 'SPOUSE',
                field: 'dateOfBirth',
                value: formData.dateOfBirth,
                age,
                errorMessage: 'Minimum age is 18 years old for a spouse',
              },
            });
          } catch (sentryErr) {
            console.error('Sentry error:', sentryErr);
          }
          return;
        }
      } else if (isChild) {
        // Validate child age is between 1 day and 24 years
        const age = calculateAge(formData.dateOfBirth);
        const today = new Date();
        const birthDate = new Date(formData.dateOfBirth);
        const daysOld = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOld < 1) {
          setError('Child age must be at least 1 day old');
          try {
            Sentry.captureException(new Error('Child age validation failed'), {
              tags: {
                component: 'EditDependantDialog',
                action: 'age_validation_error',
              },
              extra: {
                dependantId: dependant.id,
                relationship: 'CHILD',
                field: 'dateOfBirth',
                value: formData.dateOfBirth,
                age,
                daysOld,
                errorMessage: 'Child age must be at least 1 day old',
              },
            });
          } catch (sentryErr) {
            console.error('Sentry error:', sentryErr);
          }
          return;
        }

        if (age >= 25) {
          setError('Child age must be less than 25 years old');
          try {
            Sentry.captureException(new Error('Child age validation failed'), {
              tags: {
                component: 'EditDependantDialog',
                action: 'age_validation_error',
              },
              extra: {
                dependantId: dependant.id,
                relationship: 'CHILD',
                field: 'dateOfBirth',
                value: formData.dateOfBirth,
                age,
                errorMessage: 'Child age must be less than 25 years old',
              },
            });
          } catch (sentryErr) {
            console.error('Sentry error:', sentryErr);
          }
          return;
        }
      }
    }

    setLoading(true);

    try {
      const updateData: UpdateDependantData = {
        ...formData,
        idType: mapIdTypeToBackend(formData.idType),
      };

      await updateDependant(dependant.id, updateData);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating dependant:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'EditDependantDialog',
            action: 'update_dependant',
          },
          extra: {
            dependantId: dependant.id,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to update dependant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Dependant</DialogTitle>
          <DialogDescription>Update dependant information</DialogDescription>
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
                max={
                  dependant.relationship === 'SPOUSE' || dependant.relationship === 'spouse'
                    ? getMinDateForAdults()
                    : getMaxDateForChildren()
                }
                min={
                  dependant.relationship === 'CHILD' || dependant.relationship === 'child'
                    ? getMinDateForChildren()
                    : undefined
                }
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
