'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Loader2, CheckCircle, LayoutDashboard } from 'lucide-react';
import { createCustomer, createAgentRegistration, CustomerRegistrationRequest } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useBrandAmbassador } from '@/hooks/useBrandAmbassador';

// Mock data for form state
interface CustomerFormData {
  // Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  idType: string;
  idNumber: string;

  // Address Information - Removed as not required by API

  // Dependants (Spouse & Children)
  spouses: Array<{
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phoneNumber: string;
    idType: string;
    idNumber: string;
  }>;
  children: Array<{
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phoneNumber: string;
    idType: string;
    idNumber: string;
  }>;
}

// Helper functions for date validation (currently unused but kept for future use)
// const getMinDateForAdults = () => {
//   const today = new Date();
//   const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
//   return minDate.toISOString().split('T')[0];
// };

import { validatePhoneNumber, formatPhoneNumber } from '@/lib/phone-validation';

// Helper functions
const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

// Helper function to map frontend ID types to backend values
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

// Get minimum date for adults (18 years ago from today)
// Used as max attribute on date inputs to prevent selecting dates that would make age < 18
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

// Calculate if child requires verification (age 18-24)
const calculateChildVerificationRequired = (dateOfBirth: string): boolean => {
  if (!dateOfBirth) return false;
  const age = calculateAge(dateOfBirth);
  return age >= 18 && age < 25;
};

const initialFormData: CustomerFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  dateOfBirth: '', // Empty string to show placeholder
  gender: 'MALE', // Default to Male
  idType: 'NATIONAL_ID', // Default to National ID
  idNumber: '',
  spouses: [],
  children: [],
};

export default function CustomerStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userMetadata, loading: authLoading } = useAuth();
  const { baInfo } = useBrandAmbassador();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle success notification from payment page
  useEffect(() => {
    const success = searchParams.get('success');
    const customerName = searchParams.get('customerName');

    if (success === 'true' && customerName) {
      setSuccessMessage(`The customer '${customerName}' was registered successfully`);
      // Clear form data for next registration
      setFormData(initialFormData);
      // Clear URL parameters after showing message
      router.replace('/register/customer');
    }
  }, [searchParams, router]);

  const handleInputChange = (field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSpouseChange = (spouseIndex: number, field: keyof NonNullable<CustomerFormData['spouses'][0]>, value: string) => {
    setFormData(prev => ({
      ...prev,
      spouses: prev.spouses.map((spouse, index) =>
        index === spouseIndex ? { ...spouse, [field]: value } : spouse
      )
    }));
  };

  const addSpouse = () => {
    if (formData.spouses.length < 2) {
      setFormData(prev => ({
        ...prev,
        spouses: [...prev.spouses, { firstName: '', middleName: '', lastName: '', gender: '', dateOfBirth: '', phoneNumber: '', idType: 'NATIONAL_ID', idNumber: '' }]
      }));
    }
  };

  const removeSpouse = (spouseIndex: number) => {
    setFormData(prev => ({
      ...prev,
      spouses: prev.spouses.filter((_, index) => index !== spouseIndex)
    }));
  };

  const addChild = () => {
    if (formData.children.length < 7) {
      setFormData(prev => ({
        ...prev,
        children: [...prev.children, { firstName: '', middleName: '', lastName: '', gender: 'MALE', dateOfBirth: '', phoneNumber: '', idType: 'BIRTH_CERTIFICATE', idNumber: '' }]
      }));
    }
  };

  const removeChild = (index: number) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index)
    }));
  };

  const handleChildChange = (index: number, field: keyof CustomerFormData['children'][0], value: string) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.map((child, i) =>
        i === index ? { ...child, [field]: value } : child
      )
    }));
  };

  const handleNext = async () => {
    console.log('🔍 Debug - User:', user);
    console.log('🔍 Debug - UserMetadata:', userMetadata);
    console.log('🔍 Debug - AuthLoading:', authLoading);
    if (!user) {
      console.log('❌ Auth check failed - no user');
      setError('Authentication required. Please log in again.');
      return;
    }

    // Get partner ID from Brand Ambassador info (cached)
    const partnerId = baInfo?.partnerId ?? 1; // Fallback to partner 1 if BA info not loaded
    console.log('🔍 Using partnerId from BA info:', partnerId);
    console.log('🔍 BA info:', baInfo);

    // Clear any previous errors
    setError(null);

    // Validate required fields BEFORE setting isSubmitting
    const requiredFields = [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'email', label: 'Email' },
      { field: 'phoneNumber', label: 'Phone Number' },
      { field: 'dateOfBirth', label: 'Date of Birth' },
      { field: 'idType', label: 'ID Type' },
      { field: 'idNumber', label: 'ID Number' },
    ];

    for (const { field, label } of requiredFields) {
      if (!formData[field as keyof CustomerFormData]?.toString().trim()) {
        setError(`${label} is required`);
        try {
          Sentry.captureException(new Error('Validation error'), {
            tags: {
              component: 'CustomerRegistration',
              action: 'validation_error',
            },
            extra: {
              field,
              label,
              errorMessage: `${label} is required`,
            },
          });
        } catch (sentryErr) {
          console.error('Sentry error:', sentryErr);
        }
        return;
      }
    }

    // Validate email format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      try {
        Sentry.captureException(new Error('Validation error'), {
          tags: {
            component: 'CustomerRegistration',
            action: 'validation_error',
          },
          extra: {
            field: 'email',
            value: formData.email,
            errorMessage: 'Please enter a valid email address',
          },
        });
      } catch (sentryErr) {
        console.error('Sentry error:', sentryErr);
      }
      return;
    }

    // Validate date of birth is not in the future
    if (formData.dateOfBirth) {
      const selectedDate = new Date(formData.dateOfBirth);
      const today = new Date();
      if (selectedDate > today) {
        setError('Date of birth cannot be in the future');
        try {
          Sentry.captureException(new Error('Validation error'), {
            tags: {
              component: 'CustomerRegistration',
              action: 'validation_error',
            },
            extra: {
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
              component: 'CustomerRegistration',
              action: 'age_validation_error',
            },
            extra: {
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

    // Validate phone numbers if provided
    if (formData.phoneNumber && !validatePhoneNumber(formData.phoneNumber)) {
      setError('Principal member phone number must be 10 digits starting with 01 or 07');
      return;
    }

    // Validate spouse required fields
    for (let i = 0; i < formData.spouses.length; i++) {
      const spouse = formData.spouses[i];
      if (!spouse.firstName?.trim()) {
        setError(`Spouse ${i + 1} first name is required`);
        return;
      }
      if (!spouse.lastName?.trim()) {
        setError(`Spouse ${i + 1} last name is required`);
        return;
      }
      if (!spouse.gender?.trim()) {
        setError(`Spouse ${i + 1} gender is required`);
        return;
      }
      if (spouse.phoneNumber && !validatePhoneNumber(spouse.phoneNumber)) {
        setError(`Spouse ${i + 1} phone number must be 10 digits starting with 01 or 07`);
        return;
      }

      // Validate spouse is at least 18 years old
      if (spouse.dateOfBirth) {
        const age = calculateAge(spouse.dateOfBirth);
        if (age < 18) {
          setError(`Spouse ${i + 1} minimum age is 18 years old for a spouse`);
          return;
        }
      }
    }

    // Validate children phone numbers and age
    for (let i = 0; i < formData.children.length; i++) {
      const child = formData.children[i];
      if (child.phoneNumber && !validatePhoneNumber(child.phoneNumber)) {
        setError(`Child ${i + 1} phone number must be 10 digits starting with 01 or 07`);
        return;
      }

      // Validate child age if dateOfBirth is provided
      if (child.dateOfBirth) {
        const age = calculateAge(child.dateOfBirth);
        const today = new Date();
        const birthDate = new Date(child.dateOfBirth);
        const daysOld = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOld < 1) {
          setError(`Child ${i + 1} age must be at least 1 day old`);
          try {
            Sentry.captureException(new Error('Child age validation failed'), {
              tags: {
                component: 'CustomerRegistration',
                action: 'age_validation_error',
              },
              extra: {
                childIndex: i + 1,
                field: 'dateOfBirth',
                value: child.dateOfBirth,
                age,
                daysOld,
                errorMessage: `Child ${i + 1} age must be at least 1 day old`,
              },
            });
          } catch (sentryErr) {
            console.error('Sentry error:', sentryErr);
          }
          return;
        }

        if (age >= 25) {
          setError(`Child ${i + 1} age must be less than 25 years old`);
          try {
            Sentry.captureException(new Error('Child age validation failed'), {
              tags: {
                component: 'CustomerRegistration',
                action: 'age_validation_error',
              },
              extra: {
                childIndex: i + 1,
                field: 'dateOfBirth',
                value: child.dateOfBirth,
                age,
                errorMessage: `Child ${i + 1} age must be less than 25 years old`,
              },
            });
          } catch (sentryErr) {
            console.error('Sentry error:', sentryErr);
          }
          return;
        }
      }
    }

    // All validation passed, now set submitting and proceed
    setIsSubmitting(true);

    try {

      // Transform form data to API format
      const customerRequest: CustomerRegistrationRequest = {
        principalMember: {
          firstName: toTitleCase(formData.firstName),
          lastName: toTitleCase(formData.lastName),
          middleName: formData.middleName ? toTitleCase(formData.middleName) : undefined,
          dateOfBirth: formData.dateOfBirth ?? new Date().toISOString().split('T')[0], // Ensure valid date
          gender: formData.gender.toLowerCase(),
          email: formData.email ?? undefined,
          phoneNumber: formData.phoneNumber ? formatPhoneNumber(formData.phoneNumber) : undefined,
          idType: mapIdTypeToBackend(formData.idType),
          idNumber: formData.idNumber,
          partnerCustomerId: `BA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.floor(Math.random() * 10000)}`,
        },
        product: {
          productId: 'default-product', // TODO: Get from product selection
          planId: 'default-plan', // TODO: Get from plan selection
        },
        spouses: formData.spouses.length > 0 ? formData.spouses.map(spouse => {
          const baseSpouse = {
            firstName: toTitleCase(spouse.firstName),
            lastName: toTitleCase(spouse.lastName),
            middleName: spouse.middleName ? toTitleCase(spouse.middleName) : undefined,
            ...(spouse.dateOfBirth && { dateOfBirth: spouse.dateOfBirth }),
            gender: spouse.gender.toLowerCase(),
            phoneNumber: spouse.phoneNumber ? formatPhoneNumber(spouse.phoneNumber) : undefined,
          };

          // Only include idType and idNumber if idNumber is provided
          if (spouse.idNumber && spouse.idNumber.trim()) {
            return {
              ...baseSpouse,
              idType: mapIdTypeToBackend(spouse.idType),
              idNumber: spouse.idNumber,
            };
          }

          // If idNumber is empty, omit both idType and idNumber (will be null in API)
          return baseSpouse;
        }) : undefined,
        children: formData.children.length > 0 ? formData.children.map(child => ({
          firstName: toTitleCase(child.firstName),
          lastName: toTitleCase(child.lastName),
          middleName: child.middleName ? toTitleCase(child.middleName) : undefined,
          ...(child.dateOfBirth && { dateOfBirth: child.dateOfBirth }),
          gender: child.gender.toLowerCase(),
          phoneNumber: child.phoneNumber ? formatPhoneNumber(child.phoneNumber) : undefined,
          verificationRequired: child.dateOfBirth ? calculateChildVerificationRequired(child.dateOfBirth) : false,
          // idType and idNumber are omitted (will be null/undefined in API)
        })) : undefined,
      };

      // Step 1: Create customer
      const customerResult = await createCustomer(customerRequest);
      if (!customerResult.success || !customerResult.customerId) {
        throw new Error(customerResult.error ?? 'Failed to create customer');
      }

      // Step 2: Create agent registration
      console.log('🔍 DEBUG: Attempting agent registration with:', {
        customerId: customerResult.customerId,
        baId: user.id,
        // partnerId will be derived from BA record in the backend
        registrationStatus: 'IN_PROGRESS',
      });

      const registrationResult = await createAgentRegistration({
        customerId: customerResult.customerId,
        baId: user.id, // Using user ID as BA ID for now
        // partnerId will be derived from BA record in the backend
        registrationStatus: 'IN_PROGRESS',
      });

      console.log('🔍 DEBUG: Agent registration result:', registrationResult);

      if (!registrationResult.success) {
        console.error('❌ Agent registration failed:', registrationResult.error);
        throw new Error(registrationResult.error ?? 'Failed to create agent registration');
      }

      // Clear any previous beneficiary form data
      localStorage.removeItem('beneficiaryFormData');

      // Save form data to localStorage for next steps
      localStorage.setItem('customerFormData', JSON.stringify(formData));
      localStorage.setItem('customerId', customerResult.customerId);
      localStorage.setItem('registrationId', registrationResult.registrationId ?? '');

      // Navigate to next step
      router.push('/register/beneficiary');

    } catch (error) {
      console.error('Error creating customer registration:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Customer Information</h2>
          <p className="text-gray-600">Enter the customer's personal details and dependants</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard/default')}
          className="flex items-center gap-2"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Button>
      </div>

      {/* Success Display */}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Principal Member Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName}
                onChange={(e) => handleInputChange('middleName', e.target.value)}
                placeholder="Enter middle name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
                required
              />
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
                placeholder="01xxxxxxxx or 07xxxxxxxx"
                maxLength={10}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                max={getMinDateForAdults()}
              />
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
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
        </CardContent>
      </Card>

      {/* Address Information - Temporarily Hidden */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Address Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              value={formData.street}
              onChange={(e) => handleInputChange('street', e.target.value)}
              placeholder="Enter street address"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Enter city"
              />
            </div>
            <div>
              <Label htmlFor="state">State/County</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                placeholder="Enter state/county"
              />
            </div>
            <div>
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => handleInputChange('postalCode', e.target.value)}
                placeholder="Enter postal code"
              />
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Dependants */}
      <Card>
        <CardHeader>
          <CardTitle>Dependants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Spouses */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Spouses ({formData.spouses.length}/2)</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={addSpouse}
                disabled={formData.spouses.length >= 2}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Spouse
              </Button>
            </div>

            {formData.spouses.map((spouse, spouseIndex) => (
              <div key={spouseIndex} className="mb-6">
                <h4 className="text-md font-medium mb-4">Spouse {spouseIndex + 1}</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div>
                    <Label htmlFor={`spouseFirstName_${spouseIndex}`}>First Name *</Label>
                    <Input
                      id={`spouseFirstName_${spouseIndex}`}
                      value={spouse.firstName}
                      onChange={(e) => handleSpouseChange(spouseIndex, 'firstName', e.target.value)}
                      placeholder="Enter spouse first name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`spouseMiddleName_${spouseIndex}`}>Middle Name</Label>
                    <Input
                      id={`spouseMiddleName_${spouseIndex}`}
                      value={spouse.middleName}
                      onChange={(e) => handleSpouseChange(spouseIndex, 'middleName', e.target.value)}
                      placeholder="Enter spouse middle name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`spouseLastName_${spouseIndex}`}>Last Name *</Label>
                    <Input
                      id={`spouseLastName_${spouseIndex}`}
                      value={spouse.lastName}
                      onChange={(e) => handleSpouseChange(spouseIndex, 'lastName', e.target.value)}
                      placeholder="Enter spouse last name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`spouseGender_${spouseIndex}`}>Gender *</Label>
                    <Select
                      value={spouse.gender}
                      onValueChange={(value) => handleSpouseChange(spouseIndex, 'gender', value)}
                      required
                    >
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
                    <Label htmlFor={`spouseDateOfBirth_${spouseIndex}`}>Date of Birth</Label>
                    <Input
                      id={`spouseDateOfBirth_${spouseIndex}`}
                      type="date"
                      value={spouse.dateOfBirth}
                      onChange={(e) => handleSpouseChange(spouseIndex, 'dateOfBirth', e.target.value)}
                      max={getMinDateForAdults()}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`spousePhoneNumber_${spouseIndex}`}>Phone Number</Label>
                    <Input
                      id={`spousePhoneNumber_${spouseIndex}`}
                      value={spouse.phoneNumber}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        handleSpouseChange(spouseIndex, 'phoneNumber', formatted);
                      }}
                      placeholder="01xxxxxxxx or 07xxxxxxxx"
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`spouseIdType_${spouseIndex}`}>ID Type</Label>
                    <Select value={spouse.idType} onValueChange={(value) => handleSpouseChange(spouseIndex, 'idType', value)}>
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
                  <div className="flex items-end">
                    <div className="flex-1">
                      <Label htmlFor={`spouseIdNumber_${spouseIndex}`}>ID Number</Label>
                      <Input
                        id={`spouseIdNumber_${spouseIndex}`}
                        value={spouse.idNumber}
                        onChange={(e) => handleSpouseChange(spouseIndex, 'idNumber', e.target.value)}
                        placeholder="Enter spouse ID number"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeSpouse(spouseIndex)}
                      className="ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Children */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Children ({formData.children.length}/7)</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={addChild}
                disabled={formData.children.length >= 7}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Child
              </Button>
            </div>

            {formData.children.map((child, index) => (
              <div key={index} className="mb-6">
                <h4 className="text-md font-medium mb-4">Child {index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div>
                    <Label htmlFor={`childFirstName${index}`}>First Name</Label>
                    <Input
                      id={`childFirstName${index}`}
                      value={child.firstName}
                      onChange={(e) => handleChildChange(index, 'firstName', e.target.value)}
                      placeholder="Enter child first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`childMiddleName${index}`}>Middle Name</Label>
                    <Input
                      id={`childMiddleName${index}`}
                      value={child.middleName}
                      onChange={(e) => handleChildChange(index, 'middleName', e.target.value)}
                      placeholder="Enter child middle name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`childLastName${index}`}>Last Name</Label>
                    <Input
                      id={`childLastName${index}`}
                      value={child.lastName}
                      onChange={(e) => handleChildChange(index, 'lastName', e.target.value)}
                      placeholder="Enter child last name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`childGender${index}`}>Gender</Label>
                    <Select
                      value={child.gender}
                      onValueChange={(value) => handleChildChange(index, 'gender', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
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
                    <Label htmlFor={`childDateOfBirth${index}`}>Date of Birth</Label>
                    <Input
                      id={`childDateOfBirth${index}`}
                      type="date"
                      value={child.dateOfBirth}
                      onChange={(e) => handleChildChange(index, 'dateOfBirth', e.target.value)}
                      max={getMaxDateForChildren()}
                      min={getMinDateForChildren()}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeChild(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
                Registration Failed
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
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Cancel
        </Button>

        <Button
          onClick={handleNext}
          disabled={isSubmitting || authLoading}
          className="disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Customer...
            </>
          ) : (
            'Next: Beneficiary'
          )}
        </Button>
      </div>
    </div>
  );
}
