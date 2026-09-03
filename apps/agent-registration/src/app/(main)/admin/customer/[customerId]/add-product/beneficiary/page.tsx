'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCustomerDetails, type CustomerDetailData } from '@/lib/api';
import { loadWizard, saveWizard } from '../_lib/wizard-state';

export default function AddProductBeneficiaryStep() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;
  const [details, setDetails] = useState<CustomerDetailData | null>(null);
  const [beneficiaryId, setBeneficiaryId] = useState<string>('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [relationship] = useState('spouse');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadWizard(customerId);
    if (!saved.packageSchemeId) {
      router.replace(`/admin/customer/${customerId}/add-product`);
      return;
    }
    if (saved.beneficiaryId) setBeneficiaryId(saved.beneficiaryId);
    void getCustomerDetails(customerId).then((res) => setDetails(res.data));
  }, [customerId, router]);

  const people = (details?.beneficiaries ?? []).filter((b) => !b.deletedAt);

  const handleNext = () => {
    setError(null);
    if (!creatingNew && !beneficiaryId) {
      setError('Select an existing next of kin or add a new one.');
      return;
    }
    if (creatingNew && (!firstName.trim() || !lastName.trim())) {
      setError('First and last name are required for a new next of kin.');
      return;
    }
    const wizard = loadWizard(customerId);
    saveWizard(customerId, {
      ...wizard,
      beneficiaryId: creatingNew ? null : beneficiaryId,
      newBeneficiary: creatingNew
        ? {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            relationship,
            gender: 'female',
            dateOfBirth: '1990-01-01',
            percentage: '100',
          }
        : null,
    });
    router.push(`/admin/customer/${customerId}/add-product/payment`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Next of kin</h1>
      <Card>
        <CardHeader>
          <CardTitle>Exactly one beneficiary at 100%</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {people.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="nok"
                  checked={!creatingNew && beneficiaryId === b.id}
                  onChange={() => {
                    setCreatingNew(false);
                    setBeneficiaryId(b.id);
                  }}
                />
                {b.firstName} {b.lastName}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="nok"
                checked={creatingNew}
                onChange={() => {
                  setCreatingNew(true);
                  setBeneficiaryId('');
                }}
              />
              Add a new next of kin
            </label>
          </div>
          {creatingNew && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.push(`/admin/customer/${customerId}/add-product/household`)}>
              Back
            </Button>
            <Button type="button" onClick={handleNext}>Continue</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
