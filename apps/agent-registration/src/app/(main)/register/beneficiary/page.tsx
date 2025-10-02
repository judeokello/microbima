'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { addBeneficiaries, BeneficiaryData } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// Helper functions for date validation
const getMinDateForAdults = () => {
  const today = new Date();
  const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return minDate.toISOString().split('T')[0];
};

const getMaxDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
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
};

export default function BeneficiaryStep() {
  const router = useRouter();
  const { user, userMetadata, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<BeneficiaryFormData>(initialFormData);
  const [skipBeneficiary, setSkipBeneficiary] = useState(false);

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
        });
      } catch (error) {
        console.error('Error parsing saved beneficiary data:', error);
        // Keep default form data if parsing fails
      }
    }
  }, []);

  const handleInputChange = (field: keyof BeneficiaryFormData, value: string) => {
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
    if (!user || !userMetadata?.partnerId) {
      setError('Authentication required. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const customerId = localStorage.getItem('customerId');
      const registrationId = localStorage.getItem('registrationId');

      if (!customerId || !registrationId) {
        throw new Error('Customer registration not found. Please start from the beginning.');
      }

      if (!skipBeneficiary && formData.firstName.trim()) {
        // Transform form data to API format
        const beneficiaryData: BeneficiaryData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || undefined,
          dateOfBirth: formData.dateOfBirth,
          gender: 'other', // Default gender since beneficiary form doesn't collect this
          email: formData.email || undefined,
          phoneNumber: formData.phoneNumber || undefined,
          idType: formData.idType,
          idNumber: formData.idNumber,
          relationship: formData.relationship,
          relationshipDescription: formData.relationship === 'other' ? formData.customRelationship : undefined,
          percentage: 100, // Default to 100% if only one beneficiary
        };

        // Step 1: Add beneficiary to customer
        const beneficiaryResult = await addBeneficiaries(customerId, [beneficiaryData]);
        if (!beneficiaryResult.success || !beneficiaryResult.beneficiaryIds?.length) {
          throw new Error(beneficiaryResult.error ?? 'Failed to add beneficiary');
        }

        // Step 2: Create missing requirements for beneficiary if needed
        // This would typically be done based on partner configuration
        // For now, we'll skip this as it's handled by the backend when creating the registration
      }

      // Save form data for next steps
      if (!skipBeneficiary) {
        localStorage.setItem('beneficiaryFormData', JSON.stringify(formData));
      } else {
        localStorage.removeItem('beneficiaryFormData');
      }

      // Navigate to next step
      router.push('/register/payment');

    } catch (error) {
      console.error('Error processing beneficiary:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Beneficiary Information</h2>
        <p className="text-gray-600">Enter the next of kin details (optional)</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Checkbox
              id="skipBeneficiary"
              checked={skipBeneficiary}
              onCheckedChange={(checked) => setSkipBeneficiary(checked as boolean)}
            />
            <Label htmlFor="skipBeneficiary" className="text-sm font-medium">
              Skip beneficiary information (can be added later)
            </Label>
          </div>

          {!skipBeneficiary && (
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
                  <Label htmlFor="idType">ID Type *</Label>
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
                  <Label htmlFor="idNumber">ID Number *</Label>
                  <Input
                    id="idNumber"
                    value={formData.idNumber}
                    onChange={(e) => handleInputChange('idNumber', e.target.value)}
                    placeholder="Enter ID number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <Select value={formData.relationship} onValueChange={(value) => handleInputChange('relationship', value)}>
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
          )}
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
              {skipBeneficiary ? 'Skipping...' : 'Adding Beneficiary...'}
            </>
          ) : (
            'Next: Payment & Review'
          )}
        </Button>
      </div>
    </div>
  );
}
