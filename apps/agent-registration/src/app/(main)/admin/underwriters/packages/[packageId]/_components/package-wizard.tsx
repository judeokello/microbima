'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle } from 'lucide-react';

export const PACKAGE_WIZARD_STEPS = [
  { id: 1, title: 'Setup' },
  { id: 2, title: 'Pricing' },
  { id: 3, title: 'Product Utilization Configuration' },
] as const;

export type PackageWizardStep = (typeof PACKAGE_WIZARD_STEPS)[number]['id'];

interface PackageWizardProps {
  currentStep: PackageWizardStep;
  onStepChange?: (step: PackageWizardStep) => void;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onFinish?: () => void;
  nextDisabled?: boolean;
  finishDisabled?: boolean;
  loading?: boolean;
  showNav?: boolean;
}

export default function PackageWizard({
  currentStep,
  children,
  onBack,
  onNext,
  onFinish,
  nextDisabled,
  finishDisabled,
  loading,
  showNav = true,
}: PackageWizardProps) {
  const stepIndex = PACKAGE_WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {PACKAGE_WIZARD_STEPS.map((step, index) => {
              const isCompleted = index < stepIndex;
              const isCurrent = index === stepIndex;

              return (
                <div key={step.id} className="flex items-center flex-1 min-w-0">
                  <div className="flex items-center min-w-0">
                    {isCompleted ? (
                      <CheckCircle className="h-7 w-7 shrink-0 text-green-600" />
                    ) : (
                      <Circle
                        className={`h-7 w-7 shrink-0 ${
                          isCurrent ? 'text-blue-600' : 'text-muted-foreground'
                        }`}
                      />
                    )}
                    <div className="ml-2 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isCompleted
                            ? 'text-green-600'
                            : isCurrent
                              ? 'text-blue-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Step {index + 1} of {PACKAGE_WIZARD_STEPS.length}
                      </p>
                    </div>
                  </div>
                  {index < PACKAGE_WIZARD_STEPS.length - 1 && (
                    <div
                      className={`hidden md:block flex-1 h-0.5 mx-3 ${
                        isCompleted ? 'bg-green-600' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div>{children}</div>

      {showNav && (
        <div className="flex justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={!onBack || currentStep === 1 || loading}
          >
            Back
          </Button>
          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button type="button" onClick={onNext} disabled={!onNext || nextDisabled || loading}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onFinish}
                disabled={!onFinish || finishDisabled || loading}
              >
                Finish
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
