'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
// import { Separator } from '@/components/ui/separator';
import { CheckCircle, CreditCard, Users, User, Loader2 } from 'lucide-react';
import { processPayment, PaymentRequest } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface InsurancePricing {
  plans: {
    silver: {
      name: string;
      categories: {
        member_only: { display: string; daily: number; weekly: number };
        up_to_5: { display: string; daily: number; weekly: number };
        up_to_8: { display: string; daily: number; weekly: number };
      };
      additional_spouse: { daily: number; weekly: number };
    };
    gold: {
      name: string;
      categories: {
        member_only: { display: string; daily: number; weekly: number };
        up_to_5: { display: string; daily: number; weekly: number };
        up_to_8: { display: string; daily: number; weekly: number };
      };
      additional_spouse: { daily: number; weekly: number };
    };
  };
}

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
  const { user, loading: authLoading } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerFormData | null>(null);
  const [beneficiaryData, setBeneficiaryData] = useState<BeneficiaryFormData | null>(null);
  const [paymentType, setPaymentType] = useState('MPESA');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Insurance pricing state
  const [pricingData, setPricingData] = useState<InsurancePricing | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [additionalSpouse, setAdditionalSpouse] = useState(false);
  const [calculatedPricing, setCalculatedPricing] = useState({
    daily: 0,
    weekly: 0,
    totalDaily: 0,
    totalWeekly: 0
  });

  // Calculate payment end date (276 days from now)
  const calculatePaymentEndDate = () => {
    const currentDate = new Date();
    const endDate = new Date(currentDate);
    endDate.setDate(endDate.getDate() + 276);
    return endDate.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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

    // Load pricing data
    fetch('/insurance-pricing.json')
      .then(response => response.json())
      .then(data => setPricingData(data))
      .catch(error => console.error('Error loading pricing data:', error));
  }, []);

  // Calculate pricing when selections change
  useEffect(() => {
    if (!pricingData || !selectedPlan || !selectedCategory) {
      setCalculatedPricing({ daily: 0, weekly: 0, totalDaily: 0, totalWeekly: 0 });
      return;
    }

    const plan = pricingData.plans[selectedPlan as keyof typeof pricingData.plans];
    const category = plan.categories[selectedCategory as keyof typeof plan.categories];
    const spousePremium = plan.additional_spouse;

    const baseDaily = category.daily;
    const baseWeekly = category.weekly;
    const spouseDaily = additionalSpouse ? spousePremium.daily : 0;
    const spouseWeekly = additionalSpouse ? spousePremium.weekly : 0;

    setCalculatedPricing({
      daily: baseDaily,
      weekly: baseWeekly,
      totalDaily: baseDaily + spouseDaily,
      totalWeekly: baseWeekly + spouseWeekly
    });
  }, [pricingData, selectedPlan, selectedCategory, additionalSpouse]);

  // Reset category when plan changes
  useEffect(() => {
    if (selectedPlan) {
      setSelectedCategory('');
      setAdditionalSpouse(false);
    }
  }, [selectedPlan]);

  const handleBack = () => {
    router.push('/register/beneficiary');
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('Authentication required. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required data
      if (!customerData) {
        throw new Error('Customer data not found. Please start over.');
      }

      const customerId = localStorage.getItem('customerId');
      const registrationId = localStorage.getItem('registrationId');

      if (!customerId || !registrationId) {
        throw new Error('Registration data not found. Please start over.');
      }

      // Process payment
      const paymentRequest: PaymentRequest = {
        customerId,
        registrationId,
        phoneNumber: paymentPhone,
        amount: 900, // Weekly payment amount in cents
        currency: 'KES'
      };

      console.log('Processing payment:', paymentRequest);

      const paymentResult = await processPayment(paymentRequest);
      if (!paymentResult.success) {
        throw new Error(paymentResult.error ?? 'Payment processing failed');
      }

      console.log('Payment successful:', paymentResult);

      // Clear saved data
      localStorage.removeItem('customerFormData');
      localStorage.removeItem('beneficiaryFormData');
      localStorage.removeItem('customerId');
      localStorage.removeItem('registrationId');

      // Get customer name for success message
      const customerName = customerData ? `${customerData.firstName} ${customerData.lastName}` : 'Customer';

      // Redirect to first page with success notification
      router.push(`/register/customer?success=true&customerName=${encodeURIComponent(customerName)}&paymentId=${paymentResult.paymentId}`);

    } catch (error) {
      console.error('Registration submission failed:', error);
      setError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
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
            {/* Plan Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planSelection">Insurance Plan</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger id="planSelection">
                    <SelectValue placeholder="Select insurance plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingData && (
                      <>
                        <SelectItem value="silver">{pricingData.plans.silver.name}</SelectItem>
                        <SelectItem value="gold">{pricingData.plans.gold.name}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="familyCategory">Family Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={!selectedPlan}>
                  <SelectTrigger id="familyCategory">
                    <SelectValue placeholder="Select family category" />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingData && selectedPlan && (
                      <>
                        {Object.entries(pricingData.plans[selectedPlan as keyof typeof pricingData.plans].categories).map(([key, category]) => (
                          <SelectItem key={key} value={key}>
                            {category.display} - {category.daily}d - {category.weekly}w
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional Spouse Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="additionalSpouse"
                checked={additionalSpouse}
                onCheckedChange={(checked) => setAdditionalSpouse(checked === true)}
                disabled={!selectedCategory || selectedCategory === 'member_only'}
              />
              <Label htmlFor="additionalSpouse" className="text-sm">
                Additional Spouse Premium
                {pricingData && selectedPlan && selectedCategory !== 'member_only' && (
                  <span className="text-gray-500 ml-1">
                    (+{pricingData.plans[selectedPlan as keyof typeof pricingData.plans].additional_spouse.daily} KES/day, +{pricingData.plans[selectedPlan as keyof typeof pricingData.plans].additional_spouse.weekly} KES/week)
                  </span>
                )}
              </Label>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <h3 className="font-semibold text-blue-900">Mfanisi GO</h3>
                <p className="text-sm text-blue-700">Comprehensive insurance coverage</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-700">Daily Payment</p>
                <p className="text-lg font-bold text-blue-900">{calculatedPricing.totalDaily} KES</p>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p>• Daily payment: {calculatedPricing.totalDaily} KES</p>
              <p>• Weekly payment: {calculatedPricing.totalWeekly} KES (recommended)</p>
              <p>• Payment end date: {calculatePaymentEndDate()}</p>
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
                <p className="text-lg">{customerData.email ?? 'Not provided'}</p>
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
                <p className="text-lg">{beneficiaryData.phoneNumber ?? 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Date of Birth</p>
                <p className="text-lg">{beneficiaryData.dateOfBirth ?? 'Not provided'}</p>
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
              <Label htmlFor="paymentType">Payment Type</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger id="paymentType">
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MPESA">MPESA</SelectItem>
                  <SelectItem value="SasaPay">SasaPay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Total Amount</Label>
              <div className="flex items-center h-10 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-900">
                {calculatedPricing.totalDaily} KES
              </div>
              <p className="text-xs text-gray-500 mt-1">Daily premium amount</p>
            </div>

            <div>
              <Label htmlFor="paymentPhone">Payment Phone Number <span className="text-red-500">*</span></Label>
              <Input
                id="paymentPhone"
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value)}
                placeholder="Enter phone number for payment"
                required
              />
              <p className="text-sm text-gray-600 mt-1">
                This phone number will receive the payment request
              </p>
            </div>

            <div>
              <Label htmlFor="transactionReference">Transaction Reference <span className="text-red-500">*</span></Label>
              <Input
                id="transactionReference"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="Enter transaction reference"
                required
              />
              <p className="text-sm text-gray-600 mt-1">
                Enter the transaction reference for this payment
              </p>
            </div>

            {/* <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Payment Instructions</h4>
              <ol className="text-sm text-yellow-800 space-y-1">
                <li>1. Click "Submit Payment" below</li>
                <li>2. You will receive an MPESA prompt on {paymentPhone || 'your phone'}</li>
                <li>3. Enter your MPESA PIN to complete payment</li>
                <li>4. Registration will be confirmed after successful payment</li>
              </ol>
            </div> */}
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
                Payment Failed
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
          Back: Beneficiary
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !paymentPhone || !transactionReference || authLoading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Payment...
            </>
          ) : (
            'Submit Payment'
          )}
        </Button>
      </div>
    </div>
  );
}
