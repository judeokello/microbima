'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';

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
  
  // Address Information
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  
  // Dependants (Spouse & Children)
  spouse: {
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phoneNumber: string;
  } | null;
  children: Array<{
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
  }>;
}

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

// For children - no validation, allow any date
const getMinDateForChildren = () => {
  // Set to a very old date to allow any reasonable birth date
  return '1900-01-01';
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
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'KE',
  spouse: null,
  children: [],
};

export default function CustomerStep() {
  const router = useRouter();
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [showSpouse, setShowSpouse] = useState(false);

  const handleInputChange = (field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSpouseChange = (field: keyof NonNullable<CustomerFormData['spouse']>, value: string) => {
    setFormData(prev => ({
      ...prev,
      spouse: prev.spouse ? { ...prev.spouse, [field]: value } : { firstName: '', middleName: '', lastName: '', gender: 'FEMALE', dateOfBirth: '', phoneNumber: '' }
    }));
  };

  const addChild = () => {
    setFormData(prev => ({
      ...prev,
      children: [...prev.children, { firstName: '', middleName: '', lastName: '', gender: '', dateOfBirth: '' }]
    }));
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

  const handleNext = () => {
    // Save form data to localStorage for now (mock data approach)
    localStorage.setItem('customerFormData', JSON.stringify(formData));
    router.push('/register/beneficiary');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Customer Information</h2>
        <p className="text-gray-600">Enter the customer's personal details and dependants</p>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
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
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
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
          {/* Spouse */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Spouse</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSpouse(!showSpouse)}
              >
                {showSpouse ? 'Remove Spouse' : 'Add Spouse'}
              </Button>
            </div>
            
            {showSpouse && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div>
                  <Label htmlFor="spouseFirstName">First Name</Label>
                  <Input
                    id="spouseFirstName"
                    value={formData.spouse?.firstName || ''}
                    onChange={(e) => handleSpouseChange('firstName', e.target.value)}
                    placeholder="Enter spouse first name"
                  />
                </div>
                <div>
                  <Label htmlFor="spouseMiddleName">Middle Name</Label>
                  <Input
                    id="spouseMiddleName"
                    value={formData.spouse?.middleName || ''}
                    onChange={(e) => handleSpouseChange('middleName', e.target.value)}
                    placeholder="Enter spouse middle name"
                  />
                </div>
                <div>
                  <Label htmlFor="spouseLastName">Last Name</Label>
                  <Input
                    id="spouseLastName"
                    value={formData.spouse?.lastName || ''}
                    onChange={(e) => handleSpouseChange('lastName', e.target.value)}
                    placeholder="Enter spouse last name"
                  />
                </div>
                <div>
                  <Label htmlFor="spouseGender">Gender</Label>
                  <Select 
                    value={formData.spouse?.gender || 'FEMALE'} 
                    onValueChange={(value) => handleSpouseChange('gender', value)}
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
                  <Label htmlFor="spouseDateOfBirth">Date of Birth</Label>
                  <Input
                    id="spouseDateOfBirth"
                    type="date"
                    value={formData.spouse?.dateOfBirth || ''}
                    onChange={(e) => handleSpouseChange('dateOfBirth', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="spousePhoneNumber">Phone Number</Label>
                  <Input
                    id="spousePhoneNumber"
                    value={formData.spouse?.phoneNumber || ''}
                    onChange={(e) => handleSpouseChange('phoneNumber', e.target.value)}
                    placeholder="Enter spouse phone number"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Children */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Children ({formData.children.length})</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={addChild}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Child
              </Button>
            </div>
            
            {formData.children.map((child, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg mb-4">
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
                <div className="flex items-end">
                  <div className="flex-1">
                    <Label htmlFor={`childDateOfBirth${index}`}>Date of Birth</Label>
                    <Input
                      id={`childDateOfBirth${index}`}
                      type="date"
                      value={child.dateOfBirth}
                      onChange={(e) => handleChildChange(index, 'dateOfBirth', e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeChild(index)}
                    className="ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Cancel
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next: Beneficiary
        </Button>
      </div>
    </div>
  );
}
