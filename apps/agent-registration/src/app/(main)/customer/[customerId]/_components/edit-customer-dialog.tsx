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
import { updateCustomer, UpdateCustomerData } from '@/lib/api';
import { formatPhoneNumber, getPhoneValidationError } from '@/lib/phone-validation';
import * as Sentry from '@sentry/nextjs';

interface EditCustomerDialogProps {
  customer: {
    id: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    email?: string;
    phoneNumber?: string;
    gender?: string;
    idType: string;
    idNumber: string;
  };
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

const mapIdTypeFromBackend = (idType: string): string => {
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

export default function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: EditCustomerDialogProps) {
  const [formData, setFormData] = useState<UpdateCustomerData>({
    firstName: customer.firstName,
    middleName: customer.middleName,
    lastName: customer.lastName,
    dateOfBirth: customer.dateOfBirth,
    email: customer.email,
    phoneNumber: customer.phoneNumber,
    gender: mapGenderFromBackend(customer.gender),
    idType: mapIdTypeFromBackend(customer.idType),
    idNumber: customer.idNumber,
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

    // Validate date of birth is not in the future
    if (formData.dateOfBirth) {
      const selectedDate = new Date(formData.dateOfBirth);
      const today = new Date();
      if (selectedDate > today) {
        setError('Date of birth cannot be in the future');
        try {
          Sentry.captureException(new Error('Date of birth validation failed'), {
            tags: {
              component: 'EditCustomerDialog',
              action: 'validation_error',
            },
            extra: {
              customerId: customer.id,
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

      // Validate principal member is at least 18 years old
      const age = calculateAge(formData.dateOfBirth);
      if (age < 18) {
        setError('Minimum age is 18 years old for a Principal member');
        try {
          Sentry.captureException(new Error('Age validation failed'), {
            tags: {
              component: 'EditCustomerDialog',
              action: 'age_validation_error',
            },
            extra: {
              customerId: customer.id,
              field: 'dateOfBirth',
              value: formData.dateOfBirth,
              age,
              errorMessage: 'Minimum age is 18 years old for a Principal member',
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
      const updateData: UpdateCustomerData = {
        ...formData,
        idType: mapIdTypeToBackend(formData.idType ?? 'NATIONAL_ID'),
      };

      await updateCustomer(customer.id, updateData);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating customer:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'EditCustomerDialog',
            action: 'update_customer',
          },
          extra: {
            customerId: customer.id,
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to update customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>Update customer information</DialogDescription>
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
                value={formData.middleName ?? ''}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value || undefined })}
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
                value={formData.dateOfBirth ?? ''}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value || undefined })}
                max={getMinDateForAdults()}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email ?? ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value || undefined })}
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
