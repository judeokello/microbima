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
import { addBeneficiaries, BeneficiaryData } from '@/lib/api';
import { useParams } from 'next/navigation';
import { formatPhoneNumber, getPhoneValidationError } from '@/lib/phone-validation';
import * as Sentry from '@sentry/nextjs';

interface AddBeneficiaryDialogProps {
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

export default function AddBeneficiaryDialog({
  customerId,
  open,
  onOpenChange,
  onSuccess,
}: AddBeneficiaryDialogProps) {
  const params = useParams();
  const actualCustomerId = customerId ?? (params.customerId as string);

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    phoneNumber: '',
    gender: '',
    idType: 'NATIONAL_ID',
    idNumber: '',
    relationship: 'other',
    relationshipDescription: 'Next of Kin',
    percentage: 100,
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
    if (!formData.firstName || !formData.lastName) {
      setError('First name and last name are required');
      setLoading(false);
      return;
    }

    // Validate phone number (mandatory)
    if (!formData.phoneNumber || formData.phoneNumber.trim() === '') {
      setError('Phone number is required');
      setLoading(false);
      return;
    }

    const phoneErr = getPhoneValidationError(formData.phoneNumber);
    if (phoneErr) {
      setPhoneError(phoneErr);
      setLoading(false);
      return;
    }

    // Validate gender (mandatory)
    if (!formData.gender) {
      setError('Gender is required');
      setLoading(false);
      return;
    }

    // Validate relationship description if relationship is "other"
    if (formData.relationship === 'other' && (!formData.relationshipDescription || formData.relationshipDescription.trim() === '')) {
      setError('Relationship description is required when relationship is "Other"');
      setLoading(false);
      return;
    }

    try {
      const trimmedIdNumber = formData.idNumber.trim();
      const hasIdNumber = trimmedIdNumber.length > 0;

      const beneficiaryData: BeneficiaryData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        dateOfBirth: formData.dateOfBirth || new Date().toISOString().split('T')[0],
        gender: formData.gender,
        email: undefined,
        phoneNumber: formData.phoneNumber,
        relationship: formData.relationship,
        relationshipDescription: formData.relationship === 'other' ? (formData.relationshipDescription || undefined) : undefined,
        percentage: formData.percentage,
        ...(hasIdNumber
          ? {
              idType: mapIdTypeToBackend(formData.idType),
              idNumber: trimmedIdNumber,
            }
          : {}),
      };

      const result = await addBeneficiaries(actualCustomerId, [beneficiaryData]);
      if (!result.success) {
        // Transform API validation errors into user-friendly messages
        let errorMessage = result.error ?? 'Failed to add next of kin';

        // Handle relationship validation errors
        if (errorMessage.includes('relationship must be one of the following values')) {
          errorMessage = 'Please select a relationship';
        }

        // Handle date of birth validation errors
        if (errorMessage.includes('dateOfBirth') && errorMessage.includes('ISO 8601')) {
          errorMessage = 'Invalid date of birth. Please select a valid date.';
        }

        // Handle phone number validation errors
        if (errorMessage.includes('phoneNumber') || errorMessage.includes('phone')) {
          errorMessage = 'Please enter a valid phone number (10 digits starting with 01 or 07)';
        }

        throw new Error(errorMessage);
      }

      // Reset form
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        phoneNumber: '',
        gender: '',
        idType: 'NATIONAL_ID',
        idNumber: '',
        relationship: 'other',
        relationshipDescription: 'Next of Kin',
        percentage: 100,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error adding beneficiary:', err);
      // Report error to Sentry
      if (err instanceof Error) {
        Sentry.captureException(err, {
          tags: {
            component: 'AddBeneficiaryDialog',
            action: 'add_beneficiary',
          },
          extra: {
            customerId,
            formData: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              phoneNumber: formData.phoneNumber,
              relationship: formData.relationship,
            },
          },
        });
      }
      // Transform API validation errors into user-friendly messages
      let errorMessage = err instanceof Error ? err.message : 'Failed to add next of kin';

      // Handle relationship validation errors
      if (errorMessage.includes('relationship must be one of the following values')) {
        errorMessage = 'Please select a relationship';
      }

      // Handle date of birth validation errors
      if (errorMessage.includes('dateOfBirth') && errorMessage.includes('ISO 8601')) {
        errorMessage = 'Invalid date of birth. Please select a valid date.';
      }

      // Handle phone number validation errors
      if (errorMessage.includes('phoneNumber') || errorMessage.includes('phone')) {
        errorMessage = 'Please enter a valid phone number (10 digits starting with 01 or 07)';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Next of Kin</DialogTitle>
          <DialogDescription>Add next of kin information</DialogDescription>
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
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setFormData({ ...formData, phoneNumber: formatted });
                  setPhoneError(getPhoneValidationError(formatted));
                }}
                placeholder="01XXXXXXXX or 07XXXXXXXX"
                required
              />
              {phoneError && (
                <p className="text-sm text-red-600 mt-1">{phoneError}</p>
              )}
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
              <Label htmlFor="idNumber">ID Number</Label>
              <Input
                id="idNumber"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="relationship">Relationship</Label>
              <Select
                value={formData.relationship}
                onValueChange={(value) => setFormData({ ...formData, relationship: value })}
              >
                <SelectTrigger id="relationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="friend">Friend</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.relationship === 'other' && (
              <div>
                <Label htmlFor="relationshipDescription">Relationship Description *</Label>
                <Input
                  id="relationshipDescription"
                  value={formData.relationshipDescription}
                  onChange={(e) => setFormData({ ...formData, relationshipDescription: e.target.value })}
                  placeholder="e.g., Next of Kin, Cousin, Uncle"
                  required={formData.relationship === 'other'}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Failed to Add Next of Kin
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Next of Kin
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

