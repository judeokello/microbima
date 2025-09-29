'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Circle } from 'lucide-react';

interface WizardStep {
  id: string;
  title: string;
  path: string;
}

const steps: WizardStep[] = [
  { id: 'customer', title: 'Customer Details', path: '/register/customer' },
  { id: 'beneficiary', title: 'Beneficiary', path: '/register/beneficiary' },
  { id: 'payment', title: 'Payment & Review', path: '/register/payment' },
];

interface WizardLayoutProps {
  children: ReactNode;
}

export default function WizardLayout({ children }: WizardLayoutProps) {
  const pathname = usePathname();
  const currentStepIndex = steps.findIndex(step => step.path === pathname);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Customer Registration</h1>
          <p className="text-gray-600 mt-2">Register a new customer for Mfanisi GO</p>
        </div>

        {/* Stepper */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isUpcoming = index > currentStepIndex;

                return (
                  <div key={step.id} className="flex items-center">
                    <div className="flex items-center">
                      {isCompleted ? (
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      ) : (
                        <Circle className={`h-8 w-8 ${isCurrent ? 'text-blue-600' : 'text-gray-400'}`} />
                      )}
                      <div className="ml-3">
                        <p className={`text-sm font-medium ${
                          isCompleted ? 'text-green-600' :
                          isCurrent ? 'text-blue-600' :
                          'text-gray-500'
                        }`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          Step {index + 1} of {steps.length}
                        </p>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-4 ${
                        isCompleted ? 'bg-green-600' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card>
          <CardContent className="p-6">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

