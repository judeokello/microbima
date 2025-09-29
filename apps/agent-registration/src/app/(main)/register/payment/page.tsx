'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, CreditCard, Users, User } from 'lucide-react';

interface CustomerFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  idType: string;
  idNumber: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
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

export default function PaymentStep() {
  const router = useRouter();
  const [customerData, setCustomerData] = useState<CustomerFormData | null>(null);
  const [beneficiaryData, setBeneficiaryData] = useState<BeneficiaryFormData | null>(null);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load saved form data
    const savedCustomerData = localStorage.getItem('customerFormData');
    const savedBeneficiaryData = localStorage.getItem('beneficiaryFormData');

    if (savedCustomerData) {
      const customer = JSON.parse(savedCustomerData);
      setCustomerData(customer);
      setPaymentPhone(customer.phoneNumber); // Pre-populate with customer phone
    }

    if (savedBeneficiaryData) {
      setBeneficiaryData(JSON.parse(savedBeneficiaryData));
    }
  }, []);

  const handleBack = () => {
    router.push('/register/beneficiary');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Mock submission - in real implementation, this would call the API
      console.log('Submitting registration:', {
        customer: customerData,
        beneficiary: beneficiaryData,
        paymentPhone
      });

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clear saved data
      localStorage.removeItem('customerFormData');
      localStorage.removeItem('beneficiaryFormData');

      // Redirect to success page or dashboard
      router.push('/dashboard?success=true');
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!customerData) {
    return (
      <div className="text-center">
        <p>Loading customer data...</p>
      </div>
    );
  }

  const hasSpouse = customerData.spouse && customerData.spouse.firstName;
  const childrenCount = customerData.children.filter(child => child.firstName).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payment & Review</h2>
        <p className="text-gray-600">Review your information and complete payment</p>
      </div>

      {/* Product Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Product Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <h3 className="font-semibold text-blue-900">Mfanisi GO</h3>
                <p className="text-sm text-blue-700">Comprehensive insurance coverage</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-700">Weekly Payment</p>
                <p className="text-lg font-bold text-blue-900">900 KES</p>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p>• Daily payment: 150 KES</p>
              <p>• Weekly payment: 900 KES (recommended)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Customer Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="text-lg">{customerData.firstName} {customerData.middleName} {customerData.lastName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Phone</p>
                <p className="text-lg">{customerData.phoneNumber}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-lg">{customerData.email || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">ID</p>
                <p className="text-lg">{customerData.idType}: {customerData.idNumber}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dependants Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Dependants Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {hasSpouse && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900">Spouse</h4>
                <p className="text-green-700">{customerData.spouse!.firstName} {customerData.spouse!.middleName} {customerData.spouse!.lastName}</p>
                {customerData.spouse!.phoneNumber && (
                  <p className="text-sm text-green-600">Phone: {customerData.spouse!.phoneNumber}</p>
                )}
              </div>
            )}

            {childrenCount > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900">Children ({childrenCount})</h4>
                {customerData.children.filter(child => child.firstName).map((child, index) => (
                  <p key={index} className="text-blue-700">
                    {child.firstName} {child.middleName} {child.lastName}
                  </p>
                ))}
              </div>
            )}

            {!hasSpouse && childrenCount === 0 && (
              <p className="text-gray-500 italic">No dependants added</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Beneficiary Summary */}
      {beneficiaryData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Beneficiary Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="text-lg">{beneficiaryData.firstName} {beneficiaryData.middleName} {beneficiaryData.lastName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Relationship</p>
                <p className="text-lg">
                  {beneficiaryData.relationship === 'OTHER' && beneficiaryData.customRelationship
                    ? beneficiaryData.customRelationship
                    : beneficiaryData.relationship}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Phone</p>
                <p className="text-lg">{beneficiaryData.phoneNumber || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Date of Birth</p>
                <p className="text-lg">{beneficiaryData.dateOfBirth || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">ID</p>
                <p className="text-lg">{beneficiaryData.idType}: {beneficiaryData.idNumber}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Information */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="paymentPhone">Payment Phone Number</Label>
              <Input
                id="paymentPhone"
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value)}
                placeholder="Enter phone number for MPESA payment"
              />
              <p className="text-sm text-gray-600 mt-1">
                This phone number will receive the MPESA payment request
              </p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Payment Instructions</h4>
              <ol className="text-sm text-yellow-800 space-y-1">
                <li>1. Click "Submit Payment" below</li>
                <li>2. You will receive an MPESA prompt on {paymentPhone || 'your phone'}</li>
                <li>3. Enter your MPESA PIN to complete payment</li>
                <li>4. Registration will be confirmed after successful payment</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          Back: Beneficiary
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !paymentPhone}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? 'Processing...' : 'Submit Payment'}
        </Button>
      </div>
    </div>
  );
}
