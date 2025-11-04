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
import { addDependants, SpouseData } from '@/lib/api';
import { useParams } from 'next/navigation';
import { formatPhoneNumber, getPhoneValidationError } from '@/lib/phone-validation';
import * as Sentry from '@sentry/nextjs';

interface AddSpouseDialogProps {
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

export default function AddSpouseDialog({
  customerId,
  open,
  onOpenChange,
  onSuccess,
}: AddSpouseDialogProps) {
  const params = useParams();
  const actualCustomerId = customerId ?? (params.customerId as string);

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    phoneNumber: '',
    email: '',
    gender: '',
    idType: 'NATIONAL_ID',
    idNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPhoneError(null);

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.gender || !formData.idNumber) {
      setError('First name, last name, gender, and ID number are required');
      setLoading(false);
      return;
    }

    // Validate phone number if provided
    if (formData.phoneNumber) {
      const phoneErr = getPhoneValidationError(formData.phoneNumber);
      if (phoneErr) {
        setPhoneError(phoneErr);
        setLoading(false);
        return;
      }
    }

    try {
      const spouseData: SpouseData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender,
        email: formData.email || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        idType: mapIdTypeToBackend(formData.idType),
        idNumber: formData.idNumber,
      };

      const result = await addDependants(actualCustomerId, {
        correlationId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        spouses: [spouseData],
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to add spouse');
      }

      // Reset form
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        phoneNumber: '',
        email: '',
        gender: '',
        idType: 'NATIONAL_ID',
        idNumber: '',
      });

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error adding spouse:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'AddSpouseDialog',
            action: 'add_spouse',
          },
          extra: {
            customerId,
            formData: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              phoneNumber: formData.phoneNumber,
              gender: formData.gender,
            },
          },
        });
      }
      setError(err instanceof Error ? err.message : 'Failed to add spouse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Spouse</DialogTitle>
          <DialogDescription>Add spouse information</DialogDescription>
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
              />
            </div>

            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setFormData({ ...formData, phoneNumber: formatted });
                  setPhoneError(getPhoneValidationError(formatted));
                }}
                placeholder="01XXXXXXXX or 07XXXXXXXX"
              />
              {phoneError && (
                <p className="text-sm text-red-600 mt-1">{phoneError}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  <SelectItem value="NATIONAL_ID">National ID</SelectItem>
                  <SelectItem value="PASSPORT">Passport</SelectItem>
                  <SelectItem value="ALIEN">Alien</SelectItem>
                  <SelectItem value="BIRTH_CERTIFICATE">Birth Certificate</SelectItem>
                  <SelectItem value="MILITARY">Military</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="idNumber">ID Number *</Label>
              <Input
                id="idNumber"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                required
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
              Add Spouse
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

