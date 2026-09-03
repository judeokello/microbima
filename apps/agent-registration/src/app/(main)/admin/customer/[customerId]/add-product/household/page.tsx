'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCustomerDetails, getPackagePricingBySlug, type CustomerDetailData } from '@/lib/api';
import { extraSpouseAddonCount, householdCapsFromBands } from '@/lib/family-category';
import { pricingBandsFromApi } from '@/lib/package-pricing-ui';
import { loadWizard, saveWizard } from '../_lib/wizard-state';

function emptyPerson() {
  return { firstName: '', lastName: '', gender: 'female', dateOfBirth: '', phoneNumber: '', idNumber: '', idType: 'national' };
}

export default function AddProductHouseholdStep() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;
  const [details, setDetails] = useState<CustomerDetailData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newSpouses, setNewSpouses] = useState<Array<ReturnType<typeof emptyPerson>>>([]);
  const [newChildren, setNewChildren] = useState<Array<ReturnType<typeof emptyPerson>>>([]);
  const [newParents, setNewParents] = useState<
    Array<ReturnType<typeof emptyPerson> & { relationship: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState(householdCapsFromBands([], false));

  useEffect(() => {
    const saved = loadWizard(customerId);
    if (!saved.packageSchemeId) {
      router.replace(`/admin/customer/${customerId}/add-product`);
      return;
    }
    setSelectedIds(saved.existingDependantIds);
    void getCustomerDetails(customerId).then((res) => setDetails(res.data));
    if (saved.packageSlug) {
      void getPackagePricingBySlug(saved.packageSlug).then((pricing) => {
        setCaps(householdCapsFromBands(pricingBandsFromApi(pricing), saved.parentsSupported));
      });
    }
  }, [customerId, router]);

  const spouses = details?.dependants.filter((d) => d.relationship === 'SPOUSE' && !d.deletedAt) ?? [];
  const children = details?.dependants.filter((d) => d.relationship === 'CHILD' && !d.deletedAt) ?? [];
  const existingParents = details?.parents.filter((p) => !p.deletedAt) ?? [];

  const extraCount = useMemo(() => {
    const selected = [...spouses, ...children].filter((d) => selectedIds.includes(d.id)).length;
    return selected + newSpouses.length + newChildren.length;
  }, [spouses, children, selectedIds, newSpouses.length, newChildren.length]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleNext = () => {
    setError(null);
    if (caps.hasFamilyBands && extraCount > caps.maxExtraMembers) {
      setError(`This package allows at most ${caps.maxExtraMembers} additional spouse(s)/child(ren).`);
      return;
    }
    if (!caps.hasFamilyBands && extraCount > 0) {
      setError('This package is member-only. Household members cannot be enrolled.');
      return;
    }
    const selectedSpouses = spouses.filter((d) => selectedIds.includes(d.id)).length;
    const wizard = loadWizard(customerId);
    saveWizard(customerId, {
      ...wizard,
      existingDependantIds: selectedIds,
      newSpouses: newSpouses.filter((s) => s.firstName.trim()),
      newChildren: newChildren.filter((c) => c.firstName.trim()),
      newParents: newParents.filter((p) => p.firstName.trim()),
      extraSpouseCount: extraSpouseAddonCount(selectedSpouses + newSpouses.filter((s) => s.firstName.trim()).length),
      householdSize: 1 + extraCount,
    });
    router.push(`/admin/customer/${customerId}/add-product/beneficiary`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Household</h1>
      <Card>
        <CardHeader>
          <CardTitle>Who should join this policy?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!caps.showSpouse && !caps.showChildren && (
            <p className="text-sm text-muted-foreground">Member-only package. Spouse and children are hidden.</p>
          )}
          {caps.showSpouse && (
            <div className="space-y-2">
              <Label>Existing spouses</Label>
              {spouses.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedIds.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                  {s.firstName} {s.lastName}
                </label>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={extraCount >= caps.maxExtraMembers} onClick={() => setNewSpouses((p) => [...p, emptyPerson()])}>
                Add new spouse
              </Button>
              {newSpouses.map((s, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Input placeholder="First name" value={s.firstName} onChange={(e) => setNewSpouses((p) => p.map((x, idx) => (idx === i ? { ...x, firstName: e.target.value } : x)))} />
                  <Input placeholder="Last name" value={s.lastName} onChange={(e) => setNewSpouses((p) => p.map((x, idx) => (idx === i ? { ...x, lastName: e.target.value } : x)))} />
                </div>
              ))}
            </div>
          )}
          {caps.showChildren && (
            <div className="space-y-2">
              <Label>Existing children</Label>
              {children.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                  {c.firstName} {c.lastName}
                </label>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={extraCount >= caps.maxExtraMembers} onClick={() => setNewChildren((p) => [...p, emptyPerson()])}>
                Add new child
              </Button>
              {newChildren.map((c, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Input placeholder="First name" value={c.firstName} onChange={(e) => setNewChildren((p) => p.map((x, idx) => (idx === i ? { ...x, firstName: e.target.value } : x)))} />
                  <Input placeholder="Last name" value={c.lastName} onChange={(e) => setNewChildren((p) => p.map((x, idx) => (idx === i ? { ...x, lastName: e.target.value } : x)))} />
                </div>
              ))}
            </div>
          )}
          {caps.showParents && (
            <div className="space-y-2">
              <Label>Parents (do not count toward family size)</Label>
              {existingParents.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Existing: {existingParents.map((p) => `${p.firstName} ${p.lastName}`).join(', ')}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setNewParents((p) => [
                    ...p,
                    { ...emptyPerson(), gender: 'female', relationship: 'MOTHER' },
                  ])
                }
              >
                Add new parent
              </Button>
              {newParents.map((parent, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="First name"
                    value={parent.firstName}
                    onChange={(e) =>
                      setNewParents((p) =>
                        p.map((x, idx) => (idx === i ? { ...x, firstName: e.target.value } : x))
                      )
                    }
                  />
                  <Input
                    placeholder="Last name"
                    value={parent.lastName}
                    onChange={(e) =>
                      setNewParents((p) =>
                        p.map((x, idx) => (idx === i ? { ...x, lastName: e.target.value } : x))
                      )
                    }
                  />
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={parent.relationship}
                    onChange={(e) =>
                      setNewParents((p) =>
                        p.map((x, idx) => (idx === i ? { ...x, relationship: e.target.value } : x))
                      )
                    }
                  >
                    <option value="MOTHER">Mother</option>
                    <option value="FATHER">Father</option>
                    <option value="MOTHER_IN_LAW">Mother-in-law</option>
                    <option value="FATHER_IN_LAW">Father-in-law</option>
                  </select>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Extra members: {extraCount}/{caps.maxExtraMembers}. Parents do not count toward this cap.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.push(`/admin/customer/${customerId}/add-product`)}>Back</Button>
            <Button type="button" onClick={handleNext}>Continue</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
