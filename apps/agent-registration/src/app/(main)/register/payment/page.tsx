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
import { createPolicy, CreatePolicyRequest, getPackagePlans, Plan, initiateStkPush, InitiateStkPushRequest, getInternalConfig } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

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
  spouses: Array<{
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phoneNumber: string;
    idType?: string;
    idNumber?: string;
  }>;
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
  const { user, userMetadata, loading: authLoading } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerFormData | null>(null);
  const [beneficiaryData, setBeneficiaryData] = useState<BeneficiaryFormData | null>(null);
  const [paymentType, setPaymentType] = useState('MPESA');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPaymentInitiated, setIsPaymentInitiated] = useState(false);
  const [stkPushEnabled, setStkPushEnabled] = useState(false);

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

  // Payment frequency state
  const [selectedFrequency, setSelectedFrequency] = useState<string>('');
  const [customCadence, setCustomCadence] = useState<string>('');
  const [isPostpaidScheme, setIsPostpaidScheme] = useState<boolean>(false);
  const [schemeFrequency, setSchemeFrequency] = useState<string | null>(null);
  const [schemeCadence, setSchemeCadence] = useState<number | null>(null);

  // Helper function to get days for a frequency
  const getFrequencyDays = (frequency: string, cadence?: number): number => {
    switch (frequency) {
      case 'DAILY': return 1;
      case 'WEEKLY': return 7;
      case 'MONTHLY': return 31;
      case 'QUARTERLY': return 90;
      case 'ANNUALLY': return 365;
      case 'CUSTOM': return cadence ?? 0;
      default: return 0;
    }
  };

  // Format frequency display with days
  const formatFrequencyDisplay = (frequency: string, cadence?: number): string => {
    const days = getFrequencyDays(frequency, cadence);
    switch (frequency) {
      case 'DAILY': return `Daily (${days} day)`;
      case 'WEEKLY': return `Weekly (${days} days)`;
      case 'MONTHLY': return `Monthly (${days} days)`;
      case 'QUARTERLY': return `Quarterly (${days} days)`;
      case 'ANNUALLY': return `Yearly (${days} days)`;
      case 'CUSTOM': return `Custom (${cadence} days)`;
      default: return 'Select Frequency';
    }
  };

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
    const customerId = localStorage.getItem('customerId');

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

    // Fetch customer's scheme information if they belong to one
    if (customerId) {
      // Get Supabase token for authenticated request
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}/scheme`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          })
            .then(response => {
              if (response.ok) {
                return response.json();
              }
              // Customer may not belong to a scheme, which is fine
              return null;
            })
            .then(data => {
              if (data && data.data) {
                const scheme = data.data;
                setIsPostpaidScheme(scheme.isPostpaid ?? false);
                setSchemeFrequency(scheme.frequency);
                setSchemeCadence(scheme.paymentCadence);

                // If postpaid, set the frequency to the scheme's frequency
                if (scheme.isPostpaid && scheme.frequency) {
                  setSelectedFrequency(scheme.frequency);
                  if (scheme.frequency === 'CUSTOM' && scheme.paymentCadence) {
                    setCustomCadence(scheme.paymentCadence.toString());
                  }
                }
              }
            })
            .catch(error => console.error('Error loading scheme data:', error));
        }
      });
    }

    // Fetch runtime config (e.g. STK push enabled) for payment flow
    getInternalConfig()
      .then((config) => setStkPushEnabled(config.mpesaStkPushEnabled))
      .catch(() => setStkPushEnabled(false));
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

    // Clear any previous errors
    setError(null);
    setSuccessMessage(null);

    // Validate required data BEFORE setting isSubmitting
    if (!customerData) {
      setError('Customer data not found. Please start over.');
      return;
    }

    const customerId = localStorage.getItem('customerId');
    const registrationId = localStorage.getItem('registrationId');

    if (!customerId || !registrationId) {
      setError('Registration data not found. Please start over.');
      return;
    }

    // Validate payment phone number
    if (!paymentPhone || paymentPhone.trim() === '') {
      setError('Payment phone number is required');
      return;
    }

    // Validate plan and category selection
    if (!selectedPlan || !selectedCategory) {
      setError('Please select an insurance plan and family category before submitting payment.');
      return;
    }

    // Validate premium is calculated
    if (calculatedPricing.totalDaily === 0 && calculatedPricing.totalWeekly === 0) {
      setError('Premium amount could not be calculated. Please select a plan and category.');
      return;
    }

    // Validate payment frequency
    if (!selectedFrequency) {
      setError('Please select a payment frequency.');
      return;
    }

    // Validate custom cadence if custom frequency is selected
    if (selectedFrequency === 'CUSTOM' && (!customCadence || parseInt(customCadence) < 1)) {
      setError('Please enter a valid cadence (number of days) for custom payment frequency.');
      return;
    }

    // All validation passed, now set submitting and proceed
    setIsSubmitting(true);

    try {
      // Postpaid: policy was already created at customer registration (Option A). Skip policy creation and STK push.
      if (isPostpaidScheme) {
        setSuccessMessage(
          'Registration complete. The policy is set up for this postpaid scheme. Payment will be recorded when your scheme administrator uploads the payment batch (e.g. bank transfer or cheque).'
        );
        setIsPaymentInitiated(true);
        return;
      }

      // Step 1: Create policy (prepaid only)
      // Get customer's packageId from their package scheme
      let packageId: number;
      try {
        // Get Supabase token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No valid session found');
        }

        const schemeResponse = await fetch(
          `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/${customerId}/scheme`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          }
        );

        if (schemeResponse.ok) {
          const schemeData = await schemeResponse.json();
          packageId = schemeData.data?.packageId;

          if (!packageId) {
            throw new Error('PackageId not found in scheme data');
          }

          console.log(`Retrieved packageId ${packageId} from customer's scheme`);
        } else {
          throw new Error(`Failed to fetch customer scheme: ${schemeResponse.status}`);
        }
      } catch (schemeError) {
        console.error('Error fetching customer scheme:', schemeError);
        setError('Failed to determine package from customer scheme. Please ensure customer is enrolled in a scheme.');
        setIsSubmitting(false);
        return;
      }

      // Fetch plans for the package to get the correct packagePlanId
      let packagePlanId: number;
      try {
        const plans = await getPackagePlans(packageId);
        const selectedPlanName = selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1); // "silver" -> "Silver"
        const matchingPlan = plans.find((plan: Plan) => plan.name.toLowerCase() === selectedPlan.toLowerCase());

        if (!matchingPlan) {
          throw new Error(`Plan "${selectedPlanName}" not found for package.`);
        }

        packagePlanId = matchingPlan.id;
        console.log(`Mapped plan "${selectedPlan}" to packagePlanId: ${packagePlanId}`);
      } catch (planError) {
        console.error('Failed to fetch plans:', planError);
        setError(`Failed to fetch plans for package ${packageId}. Please try again.`);
        setIsSubmitting(false);
        return;
      }

      // Use selected frequency from the dropdown
      const frequency = selectedFrequency as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM';

      // Determine premium amount based on frequency
      // For now, using weekly if selected, otherwise daily
      const premium = frequency === 'WEEKLY' ? calculatedPricing.totalWeekly : calculatedPricing.totalDaily;

      // Generate placeholder transaction reference for policy creation
      // The actual payment transaction reference will come from M-Pesa via IPN
      const placeholderTransactionRef = `PENDING-STK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Use UTC for expectedPaymentDate to ensure consistency
      const now = new Date();
      const expectedPaymentDateUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
      ));

      // T059: In dev/staging, redirect messaging to current user's email/phone
      const isDevOrStaging =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname.includes('127.0.0.1') ||
          window.location.hostname.includes('staging') ||
          window.location.hostname.includes('stg'));
      const messagingOverride =
        isDevOrStaging && user?.email
          ? { email: user.email, phone: userMetadata?.phone }
          : undefined;

      const policyRequest: CreatePolicyRequest = {
        customerId,
        packageId,
        packagePlanId,
        frequency,
        premium,
        productName: `MfanisiGo ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`,
        paymentData: {
          paymentType: paymentType as 'MPESA' | 'SASAPAY',
          transactionReference: placeholderTransactionRef, // Placeholder - real ref will come from IPN
          amount: premium,
          accountNumber: paymentPhone,
          details: `Payment for policy registration - ${customerData.firstName} ${customerData.lastName}`,
          expectedPaymentDate: expectedPaymentDateUTC.toISOString(),
          // Don't set actualPaymentDate - payment hasn't happened yet
        },
        // Add customDays if CUSTOM frequency is selected
        ...(frequency === 'CUSTOM' && customCadence ? { customDays: parseInt(customCadence) } : {}),
        ...(messagingOverride ? { messagingOverride } : {}),
      };

      console.log('Creating policy first (before payment):', policyRequest);

      const policyResult = await createPolicy(policyRequest);
      console.log('Policy created successfully:', policyResult);

      if (paymentType === 'MPESA' && stkPushEnabled) {
        // Step 2: Get payment account number from policy
        const paymentAccountNumber = policyResult.policy.paymentAcNumber;

        if (!paymentAccountNumber) {
          throw new Error('Payment account number not found. Please try again or use Paybill.');
        }

        console.log('Payment account number:', paymentAccountNumber);

        // Step 3: Initiate STK Push
        const stkPushRequest: InitiateStkPushRequest = {
          phoneNumber: paymentPhone,
          amount: premium,
          accountReference: paymentAccountNumber,
          transactionDesc: `Premium payment for policy - ${customerData.firstName} ${customerData.lastName}`,
        };

        console.log('Initiating STK push:', stkPushRequest);

        const stkPushResult = await initiateStkPush(stkPushRequest);
        console.log('STK push initiated successfully:', stkPushResult);

        // STK push has been initiated - payment will complete on customer's phone
        setSuccessMessage(`STK push payment request has been sent to ${paymentPhone}. Please ask the customer to check their phone and enter their M-Pesa PIN to complete the payment.`);
      } else if (paymentType === 'MPESA' && !stkPushEnabled) {
        // STK push disabled: policy created; customer pays via Paybill
        setSuccessMessage('Policy created. Customer can complete the payment by paying via Paybill.');
      } else {
        // SasaPay or other: policy created
        setSuccessMessage('Policy created. Customer can complete the payment by paying via Paybill.');
      }

      setIsPaymentInitiated(true);

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

  const spousesCount = customerData.spouses.filter(spouse => spouse.firstName).length;
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

              {/* Payment Frequency */}
              <div>
                <Label htmlFor="paymentFrequency">Payment Frequency</Label>
                <Select
                  value={selectedFrequency}
                  onValueChange={setSelectedFrequency}
                  disabled={isPostpaidScheme}
                >
                  <SelectTrigger id="paymentFrequency">
                    <SelectValue placeholder="Select Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">{formatFrequencyDisplay('DAILY')}</SelectItem>
                    <SelectItem value="WEEKLY">{formatFrequencyDisplay('WEEKLY')}</SelectItem>
                    <SelectItem value="MONTHLY">{formatFrequencyDisplay('MONTHLY')}</SelectItem>
                    <SelectItem value="QUARTERLY">{formatFrequencyDisplay('QUARTERLY')}</SelectItem>
                    <SelectItem value="ANNUALLY">{formatFrequencyDisplay('ANNUALLY')}</SelectItem>
                    {!isPostpaidScheme && <SelectItem value="CUSTOM">Custom</SelectItem>}
                  </SelectContent>
                </Select>
                {isPostpaidScheme && schemeFrequency && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Frequency is set by the scheme: {formatFrequencyDisplay(schemeFrequency, schemeCadence ?? undefined)}
                  </p>
                )}
              </div>

              {/* Custom Cadence Input */}
              {selectedFrequency === 'CUSTOM' && !isPostpaidScheme && (
                <div>
                  <Label htmlFor="customCadence">Cadence (Days)</Label>
                  <Input
                    id="customCadence"
                    type="text"
                    value={customCadence}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow digits, max 3 characters
                      if (/^\d{0,3}$/.test(value)) {
                        setCustomCadence(value);
                      }
                    }}
                    placeholder="Enter number of days"
                    maxLength={3}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the number of days between payments (1-999)
                  </p>
                </div>
              )}
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
            {spousesCount > 0 && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900">Spouses ({spousesCount})</h4>
                {customerData.spouses.filter(spouse => spouse.firstName).map((spouse, index) => (
                  <p key={index} className="text-green-700">
                    {spouse.firstName} {spouse.middleName} {spouse.lastName}
                    {spouse.phoneNumber && (
                      <span className="text-sm text-green-600 ml-2">• Phone: {spouse.phoneNumber}</span>
                    )}
                  </p>
                ))}
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

            {spousesCount === 0 && childrenCount === 0 && (
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
                  {/* Registration only supports MPESA and SASAPAY; BANK_TRANSFER/CHEQUE are for postpaid scheme payments */}
                  <SelectItem value="MPESA">MPESA</SelectItem>
                  <SelectItem value="SASAPAY">SasaPay</SelectItem>
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

      {/* Success Display */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Payment Request Sent
              </h3>
              <div className="mt-2 text-sm text-green-700">
                {successMessage}
              </div>
            </div>
          </div>
        </div>
      )}

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
          disabled={isSubmitting || !paymentPhone || authLoading || isPaymentInitiated}
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
