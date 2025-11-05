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
import { addDependants, ChildData } from '@/lib/api';
import { useParams } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';

interface AddChildDialogProps {
  customerId: string;
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

// Calculate if child requires verification (age 18-24)
const calculateChildVerificationRequired = (dateOfBirth: string): boolean => {
  if (!dateOfBirth) return false;
  const age = calculateAge(dateOfBirth);
  return age >= 18 && age < 25;
};

export default function AddChildDialog({
  customerId,
  open,
  onOpenChange,
  onSuccess,
}: AddChildDialogProps) {
  const params = useParams();
  const actualCustomerId = customerId ?? (params.customerId as string);

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    idType: 'BIRTH_CERTIFICATE',
    idNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.gender) {
      setError('First name, last name, and gender are required');
      return;
    }

    // Validate child age if dateOfBirth is provided
    if (formData.dateOfBirth) {
      const selectedDate = new Date(formData.dateOfBirth);
      const today = new Date();
      if (selectedDate > today) {
        setError('Date of birth cannot be in the future');
        try {
          Sentry.captureException(new Error('Date of birth validation failed'), {
            tags: {
              component: 'AddChildDialog',
              action: 'validation_error',
            },
            extra: {
              customerId,
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

      const age = calculateAge(formData.dateOfBirth);
      const birthDate = new Date(formData.dateOfBirth);
      const daysOld = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOld < 1) {
        setError('Child age must be at least 1 day old');
        try {
          Sentry.captureException(new Error('Child age validation failed'), {
            tags: {
              component: 'AddChildDialog',
              action: 'age_validation_error',
            },
            extra: {
              customerId,
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
              component: 'AddChildDialog',
              action: 'age_validation_error',
            },
            extra: {
              customerId,
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

    setLoading(true);

    try {
      const childData: ChildData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender,
        idType: mapIdTypeToBackend(formData.idType),
        idNumber: formData.idNumber || undefined,
        verificationRequired: formData.dateOfBirth ? calculateChildVerificationRequired(formData.dateOfBirth) : false,
      };

      const result = await addDependants(actualCustomerId, {
        correlationId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        children: [childData],
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to add child');
      }

      // Reset form
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        idType: 'BIRTH_CERTIFICATE',
        idNumber: '',
      });

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error adding child:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'AddChildDialog',
            action: 'add_child',
          },
          extra: {
            customerId,
            formData: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              gender: formData.gender,
              idType: formData.idType,
            },
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to add child');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Child</DialogTitle>
          <DialogDescription>Add child information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                max={getMaxDateForChildren()}
                min={getMinDateForChildren()}
              />
            </div>

            <div>
              <Label htmlFor="gender">Gender *</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
                required
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
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
                value={formData.idType}
                onValueChange={(value) => setFormData({ ...formData, idType: value })}
              >
                <SelectTrigger id="idType">
                  <SelectValue placeholder="Select ID Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIRTH_CERTIFICATE">Birth Certificate</SelectItem>
                  <SelectItem value="NATIONAL_ID">National ID</SelectItem>
                  <SelectItem value="PASSPORT">Passport</SelectItem>
                  <SelectItem value="ALIEN">Alien</SelectItem>
                  <SelectItem value="MILITARY">Military</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="idNumber">ID Number</Label>
              <Input
                id="idNumber"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                placeholder="Birth certificate number or National ID"
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
              Add Child
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

