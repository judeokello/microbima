'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { addBeneficiaries, BeneficiaryData } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useBrandAmbassador } from '@/hooks/useBrandAmbassador';
import * as Sentry from '@sentry/nextjs';

// Helper functions for date validation (currently unused but kept for future use)
// const getMinDateForAdults = () => {
//   const today = new Date();
//   const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
//   return minDate.toISOString().split('T')[0];
// };

// const getMaxDate = () => {
//   const today = new Date();
//   return today.toISOString().split('T')[0];
// };

import { validatePhoneNumber, formatPhoneNumber } from '@/lib/phone-validation';

// Helper functions
const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

// Helper functions for mapping frontend values to backend values
const mapIdTypeToBackend = (frontendIdType: string): string => {
  const mapping: Record<string, string> = {
    'NATIONAL_ID': 'national',
    'PASSPORT': 'passport',
    'ALIEN': 'alien',
    'BIRTH_CERTIFICATE': 'passport', // Map birth certificate to passport for now
    'MILITARY': 'national', // Map military to national for now
  };
  return mapping[frontendIdType] ?? 'national';
};

const mapGenderToBackend = (frontendGender: string): string => {
  return frontendGender.toLowerCase();
};

const mapRelationshipToBackend = (frontendRelationship: string): string => {
  return frontendRelationship.toLowerCase();
};

interface BeneficiaryFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  idType: string;
  idNumber: string;
  phoneNumber: string;
  email: string;
  relationship: string;
  customRelationship: string;
  dateOfBirth: string;
  gender: string;
}

const initialFormData: BeneficiaryFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  idType: 'NATIONAL_ID', // Default to National ID
  idNumber: '',
  phoneNumber: '',
  email: '',
  relationship: '',
  customRelationship: '',
  dateOfBirth: '',
  gender: '', // No default - user must select
};

export default function BeneficiaryStep() {
  const router = useRouter();
  const { user, userMetadata, loading: authLoading } = useAuth();
  const { baInfo, loading: baLoading } = useBrandAmbassador();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<BeneficiaryFormData>(initialFormData);

  useEffect(() => {
    // Load saved form data
    const savedData = localStorage.getItem('beneficiaryFormData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        // Ensure all fields have proper defaults to avoid controlled/uncontrolled error
        setFormData({
          firstName: parsedData.firstName ?? '',
          middleName: parsedData.middleName ?? '',
          lastName: parsedData.lastName ?? '',
          idType: parsedData.idType ?? 'NATIONAL_ID',
          idNumber: parsedData.idNumber ?? '',
          phoneNumber: parsedData.phoneNumber ?? '',
          email: parsedData.email ?? '',
          relationship: parsedData.relationship ?? '',
          customRelationship: parsedData.customRelationship ?? '',
          dateOfBirth: parsedData.dateOfBirth ?? '',
          gender: parsedData.gender ?? '',
        });
      } catch (error) {
        console.error('Error parsing saved beneficiary data:', error);
        // Keep default form data if parsing fails
      }
    }
  }, []);

  const handleInputChange = (field: keyof BeneficiaryFormData, value: string) => {
    // Special handling for ID number - only allow digits
    if (field === 'idNumber') {
      value = value.replace(/\D/g, ''); // Remove non-digit characters
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBack = () => {
    // Save current form data
    localStorage.setItem('beneficiaryFormData', JSON.stringify(formData));
    router.push('/register/customer');
  };

  const handleNext = async () => {
    console.log('🔍 ========== BENEFICIARY SUBMISSION DEBUG ==========');
    console.log('🔍 Step 1: Checking user session...');
    console.log('🔍 User:', user);
    console.log('🔍 User email:', user?.email);
    console.log('🔍 User metadata:', userMetadata);
    console.log('🔍 BA info:', baInfo);
    console.log('🔍 Partner ID from BA info:', baInfo?.partnerId);
    console.log('🔍 Auth loading:', authLoading);
    console.log('🔍 BA loading:', baLoading);

    // Remove the partnerId check - we don't actually need it for beneficiaries
    if (!user) {
      console.error('❌ No user session found');
      setError('Authentication required. Please log in again.');
      return;
    }

    console.log('✅ User session found');

    // Clear any previous errors
    setError(null);

    // Validate required fields BEFORE setting isSubmitting
    if (!formData.firstName?.trim()) {
      setError('First name is required');
      try {
        Sentry.captureException(new Error('Validation error'), {
          tags: {
            component: 'BeneficiaryRegistration',
            action: 'validation_error',
          },
          extra: {
            field: 'firstName',
            errorMessage: 'First name is required',
          },
        });
      } catch (sentryErr) {
        console.error('Sentry error:', sentryErr);
      }
      return;
    }
    if (!formData.lastName?.trim()) {
      setError('Last name is required');
      try {
        Sentry.captureException(new Error('Validation error'), {
          tags: {
            component: 'BeneficiaryRegistration',
            action: 'validation_error',
          },
          extra: {
            field: 'lastName',
            errorMessage: 'Last name is required',
          },
        });
      } catch (sentryErr) {
        console.error('Sentry error:', sentryErr);
      }
      return;
    }
    if (!formData.gender?.trim()) {
      setError('Gender is required');
      try {
        Sentry.captureException(new Error('Validation error'), {
          tags: {
            component: 'BeneficiaryRegistration',
            action: 'validation_error',
          },
          extra: {
            field: 'gender',
            errorMessage: 'Gender is required',
          },
        });
      } catch (sentryErr) {
        console.error('Sentry error:', sentryErr);
      }
      return;
    }
    if (!formData.phoneNumber || formData.phoneNumber.trim() === '') {
      setError('Phone number is required');
      try {
        Sentry.captureException(new Error('Validation error'), {
          tags: {
            component: 'BeneficiaryRegistration',
            action: 'validation_error',
          },
          extra: {
            field: 'phoneNumber',
            errorMessage: 'Phone number is required',
          },
        });
      } catch (sentryErr) {
        console.error('Sentry error:', sentryErr);
      }
      return;
    }
    if (!validatePhoneNumber(formData.phoneNumber)) {
      setError('Phone number must be 10 digits starting with 01 or 07');
      try {
        Sentry.captureException(new Error('Validation error'), {
          tags: {
            component: 'BeneficiaryRegistration',
            action: 'validation_error',
          },
          extra: {
            field: 'phoneNumber',
            value: formData.phoneNumber,
            errorMessage: 'Phone number must be 10 digits starting with 01 or 07',
          },
        });
      } catch (sentryErr) {
        console.error('Sentry error:', sentryErr);
      }
      return;
    }
    if (!formData.relationship?.trim()) {
      setError('Relationship is required');
      try {
        Sentry.captureException(new Error('Validation error'), {
          tags: {
            component: 'BeneficiaryRegistration',
            action: 'validation_error',
          },
          extra: {
            field: 'relationship',
            errorMessage: 'Relationship is required',
          },
        });
      } catch (sentryErr) {
        console.error('Sentry error:', sentryErr);
      }
      return;
    }
    if (formData.relationship === 'OTHER' && !formData.customRelationship?.trim()) {
      setError('Relationship description is required when relationship is "Other"');
      try {
        Sentry.captureException(new Error('Validation error'), {
          tags: {
            component: 'BeneficiaryRegistration',
            action: 'validation_error',
          },
          extra: {
            field: 'customRelationship',
            errorMessage: 'Relationship description is required when relationship is "Other"',
          },
        });
      } catch (sentryErr) {
        console.error('Sentry error:', sentryErr);
      }
      return;
    }

    // All validation passed, now set submitting and proceed
    setIsSubmitting(true);

    try {
      const customerId = localStorage.getItem('customerId');
      const registrationId = localStorage.getItem('registrationId');

      console.log('🔍 Step 2: Checking localStorage data...');
      console.log('🔍 Customer ID from localStorage:', customerId);
      console.log('🔍 Registration ID from localStorage:', registrationId);

      if (!customerId || !registrationId) {
        throw new Error('Customer registration not found. Please start from the beginning.');
      }

      console.log('🔍 Step 3: Processing beneficiary data...');
      console.log('🔍 Form data:', formData);

      // Transform form data to API format
      const baseBeneficiary = {
        firstName: toTitleCase(formData.firstName),
        lastName: toTitleCase(formData.lastName),
        middleName: formData.middleName ? toTitleCase(formData.middleName) : undefined,
        // dateOfBirth and email are omitted (will be null/undefined in API)
        gender: mapGenderToBackend(formData.gender),
        phoneNumber: formData.phoneNumber ? formatPhoneNumber(formData.phoneNumber) : undefined,
        relationship: mapRelationshipToBackend(formData.relationship),
        relationshipDescription: formData.relationship === 'OTHER' ? formData.customRelationship : undefined,
        percentage: 100, // Default to 100% if only one beneficiary
      };

      // Only include idType and idNumber if idNumber is provided
      const beneficiaryData: BeneficiaryData = formData.idNumber && formData.idNumber.trim()
        ? {
            ...baseBeneficiary,
            idType: mapIdTypeToBackend(formData.idType),
            idNumber: formData.idNumber,
          }
        : baseBeneficiary; // If idNumber is empty, omit both idType and idNumber (will be null in API)

      console.log('🔍 Step 4: Calling addBeneficiaries API...');
      console.log('🔍 Raw form data:', {
        idType: formData.idType,
        gender: formData.gender,
        relationship: formData.relationship,
      });
      console.log('🔍 Mapped beneficiary data:', beneficiaryData);

      // Step 1: Add beneficiary to customer
      const beneficiaryResult = await addBeneficiaries(customerId, [beneficiaryData]);
      console.log('🔍 Beneficiary result:', beneficiaryResult);

      if (!beneficiaryResult.success || !beneficiaryResult.beneficiaryIds?.length) {
        console.error('❌ Failed to add beneficiary:', beneficiaryResult.error);
        throw new Error(beneficiaryResult.error ?? 'Failed to add beneficiary');
      }

      console.log('✅ Beneficiary added successfully');

      // Save form data for next steps
      localStorage.setItem('beneficiaryFormData', JSON.stringify(formData));
      console.log('✅ Beneficiary form data saved to localStorage');

      console.log('🔍 Step 5: Navigating to payment page...');
      console.log('🔍 ========== BENEFICIARY SUBMISSION COMPLETE ==========');

      // Navigate to next step
      router.push('/register/payment');

    } catch (error) {
      console.error('Error processing beneficiary:', error);

      // Transform API validation errors into user-friendly messages
      let errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

      // Handle date of birth validation errors
      if (errorMessage.includes('dateOfBirth') && errorMessage.includes('ISO 8601')) {
        errorMessage = 'Invalid date of birth. Please select a valid date.';
      }

      // Handle relationship validation errors
      if (errorMessage.includes('relationship must be one of the following values')) {
        errorMessage = 'Please select a relationship';
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Next of Kin Information</h2>
        <p className="text-gray-600">Enter the next of kin details</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="Enter beneficiary first name"
                  />
                </div>
                <div>
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={formData.middleName}
                    onChange={(e) => handleInputChange('middleName', e.target.value)}
                    placeholder="Enter beneficiary middle name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Enter beneficiary last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="idType">ID Type </Label>
                  <Select value={formData.idType} onValueChange={(value) => handleInputChange('idType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ID type" />
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
                  <Label htmlFor="idNumber">ID Number</Label>
                  <Input
                    id="idNumber"
                    value={formData.idNumber}
                    onChange={(e) => handleInputChange('idNumber', e.target.value)}
                    placeholder="Enter ID number (optional)"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    handleInputChange('phoneNumber', formatted);
                  }}
                  placeholder="Enter phone number (01xxxxxxxx or 07xxxxxxxx)"
                  maxLength={10}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                />
              </div>

              <div>
                <Label htmlFor="gender">Gender *</Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                    <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="relationship">Relationship *</Label>
                <Select value={formData.relationship} onValueChange={(value) => handleInputChange('relationship', value)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SPOUSE">Spouse</SelectItem>
                    <SelectItem value="CHILD">Child</SelectItem>
                    <SelectItem value="PARENT">Parent</SelectItem>
                    <SelectItem value="SIBLING">Sibling</SelectItem>
                    <SelectItem value="FRIEND">Friend</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
                {formData.relationship === 'OTHER' && (
                  <div className="mt-2">
                    <Label htmlFor="customRelationship">Specify Relationship Type *</Label>
                    <Input
                      id="customRelationship"
                      value={formData.customRelationship}
                      onChange={(e) => handleInputChange('customRelationship', e.target.value)}
                      placeholder="Enter relationship type (e.g., Cousin, Uncle, etc.)"
                    />
                  </div>
                )}
              </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
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
                Beneficiary Processing Failed
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          Back: Customer Details
        </Button>

        <Button
          onClick={handleNext}
          disabled={isSubmitting || authLoading}
          className="disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Beneficiary...
            </>
          ) : (
            'Next: Payment & Review'
          )}
        </Button>
      </div>
    </div>
  );
}
