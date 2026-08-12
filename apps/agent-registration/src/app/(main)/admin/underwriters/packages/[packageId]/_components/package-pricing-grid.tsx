'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Plus, AlertTriangle, Sparkles } from 'lucide-react';
import {
  type PackagePricingCategory,
  type PackagePricingData,
  createPackagePricingCategory,
  getPackagePricing,
  putPackagePricing,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  buildInstallmentCounts,
  findFinestRate,
  frequencyRowLabel,
  getRateFromBand,
  gridFrequencies,
  isSoftLoss,
  rateBandKeyForFrequency,
  softLossFloorAmount,
  suggestFillFromLowerBand,
} from '@/lib/package-pricing-cadence.util';
import type { PricingRateBand } from '@/lib/insurance-installment';

type EditablePricing = {
  categories: PackagePricingCategory[];
  plans: PackagePricingData['plans'];
};

interface PackagePricingGridProps {
  packageId: number;
  pricing: PackagePricingData;
  readOnly?: boolean;
  onSaved: (pricing: PackagePricingData) => void;
  onWarning?: (warning: string | null) => void;
}

type EditingCell = {
  planKey: string;
  categoryKey: string;
  frequency: string;
  previousValue: number | null;
  draft: string;
};

type SoftLossHint = {
  planKey: string;
  categoryKey: string;
  frequency: string;
  amount: number;
  floorAmount: number;
};

function emptyBand(): PricingRateBand {
  return {};
}

function getCellAmount(
  plans: PackagePricingData['plans'],
  planKey: string,
  categoryKey: string,
  frequency: string
): number | null {
  const band = plans[planKey]?.rates[categoryKey] ?? emptyBand();
  return getRateFromBand(band, frequency);
}

function setCellAmount(
  plans: PackagePricingData['plans'],
  planKey: string,
  categoryKey: string,
  frequency: string,
  amount: number | null
): PackagePricingData['plans'] {
  const next = { ...plans };
  const plan = next[planKey];
  if (!plan) return plans;

  const rates = { ...plan.rates };
  const band = { ...(rates[categoryKey] ?? emptyBand()) };
  const key = rateBandKeyForFrequency(frequency);
  if (!key) return plans;

  if (amount == null || amount <= 0) {
    delete band[key];
  } else {
    band[key] = amount;
  }

  if (Object.keys(band).length === 0) {
    delete rates[categoryKey];
  } else {
    rates[categoryKey] = band;
  }

  next[planKey] = { ...plan, rates };
  return next;
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function amountsEqual(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a === b;
}

function clonePlans(plans: PackagePricingData['plans']): PackagePricingData['plans'] {
  return structuredClone(plans);
}

export default function PackagePricingGrid({
  packageId,
  pricing,
  readOnly = false,
  onSaved,
  onWarning,
}: PackagePricingGridProps) {
  const [local, setLocal] = useState<EditablePricing>(() => ({
    categories: pricing.categories,
    plans: pricing.plans,
  }));
  const [baselinePlans, setBaselinePlans] = useState<PackagePricingData['plans']>(() =>
    clonePlans(pricing.plans)
  );
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [softLossHints, setSoftLossHints] = useState<SoftLossHint[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [addingPlan, setAddingPlan] = useState(false);

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addCategoryKind, setAddCategoryKind] = useState<'UP_TO_N' | 'ADDITIONAL_SPOUSE'>('UP_TO_N');
  const [categoryDisplay, setCategoryDisplay] = useState('');
  const [maxMembers, setMaxMembers] = useState('5');
  const [addingCategory, setAddingCategory] = useState(false);

  useEffect(() => {
    setLocal({
      categories: pricing.categories,
      plans: pricing.plans,
    });
    setBaselinePlans(clonePlans(pricing.plans));
    setDirty(false);
    setSoftLossHints([]);
  }, [pricing]);

  const frequencies = useMemo(
    () => gridFrequencies(pricing.enabledFrequencies ?? []),
    [pricing.enabledFrequencies]
  );

  const installmentCounts = useMemo(() => {
    if (pricing.installmentCounts && Object.keys(pricing.installmentCounts).length > 0) {
      return { ANNUALLY: 1, ...pricing.installmentCounts };
    }
    return buildInstallmentCounts(
      (pricing.enabledFrequencies ?? []).map((frequency) => ({
        frequency,
        installmentCount: frequency === 'ANNUALLY' ? 1 : 0,
      }))
    );
  }, [pricing.installmentCounts, pricing.enabledFrequencies]);

  const planEntries = useMemo(
    () =>
      Object.entries(local.plans)
        .filter((entry): entry is [string, NonNullable<(typeof local.plans)[string]>] =>
          entry[1] != null && typeof entry[1].name === 'string'
        )
        .sort(([, a], [, b]) => {
          const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          if (orderDiff !== 0) return orderDiff;
          return a.name.localeCompare(b.name);
        }),
    [local.plans]
  );

  const hasUpToN = local.categories.some((c) => c.kind === 'UP_TO_N');
  const hasSpouse = local.categories.some((c) => c.kind === 'ADDITIONAL_SPOUSE');

  const getSupabaseToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const checkSoftLossForCell = useCallback(
    (
      plans: PackagePricingData['plans'],
      planKey: string,
      categoryKey: string,
      frequency: string,
      amount: number
    ): SoftLossHint | null => {
      const band = plans[planKey]?.rates[categoryKey] ?? emptyBand();
      const finest = findFinestRate(band, frequencies);
      if (!finest || finest.frequency === frequency) return null;
      if (
        isSoftLoss({
          finestFrequency: finest.frequency,
          finestAmount: finest.amount,
          coarserFrequency: frequency,
          coarserAmount: amount,
          installmentCounts,
        })
      ) {
        return {
          planKey,
          categoryKey,
          frequency,
          amount,
          floorAmount: softLossFloorAmount({
            finestFrequency: finest.frequency,
            finestAmount: finest.amount,
            coarserFrequency: frequency,
            installmentCounts,
          }),
        };
      }
      return null;
    },
    [frequencies, installmentCounts]
  );

  const recomputeSoftLossForBand = useCallback(
    (plans: PackagePricingData['plans'], planKey: string, categoryKey: string) => {
      setSoftLossHints((prev) => {
        const without = prev.filter(
          (h) => !(h.planKey === planKey && h.categoryKey === categoryKey)
        );
        const nextHints: SoftLossHint[] = [];
        for (const frequency of frequencies) {
          const amount = getCellAmount(plans, planKey, categoryKey, frequency);
          if (amount == null) continue;
          const hint = checkSoftLossForCell(plans, planKey, categoryKey, frequency, amount);
          if (hint) nextHints.push(hint);
        }
        return [...without, ...nextHints];
      });
    },
    [checkSoftLossForCell, frequencies]
  );

  const commitEdit = (cell: EditingCell) => {
    const parsed = cell.draft.trim() === '' ? null : parseFloat(cell.draft);
    if (cell.draft.trim() !== '' && (Number.isNaN(parsed) || (parsed != null && parsed <= 0))) {
      setError('Enter a positive number or leave empty');
      return;
    }

    const nextPlans = setCellAmount(
      local.plans,
      cell.planKey,
      cell.categoryKey,
      cell.frequency,
      parsed
    );
    setLocal((prev) => ({ ...prev, plans: nextPlans }));
    setDirty(true);
    setEditingCell(null);
    setError(null);
    recomputeSoftLossForBand(nextPlans, cell.planKey, cell.categoryKey);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        categories: local.categories.map((c) => ({
          id: c.id,
          key: c.key,
          display: c.display,
          kind: c.kind,
          maxMembers: c.maxMembers ?? undefined,
          sortOrder: c.sortOrder,
        })),
        plans: Object.fromEntries(
          Object.entries(local.plans).map(([planKey, plan]) => [
            planKey,
            {
              planId: plan.planId,
              rates: plan.rates,
            },
          ])
        ),
      };

      const saved = await putPackagePricing(packageId, body);
      setLocal({
        categories: saved.categories,
        plans: saved.plans,
      });
      setBaselinePlans(clonePlans(saved.plans));
      setDirty(false);
      setSoftLossHints([]);
      onSaved(saved);
      onWarning?.(saved.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  const handleSuggestFill = (planKey: string, categoryKey: string) => {
    const plan = local.plans[planKey];
    if (!plan) return;

    const band = plan.rates[categoryKey] ?? emptyBand();
    const hasFilled = frequencies.some((f) => getRateFromBand(band, f) != null);
    const hasEmpty = frequencies.some((f) => getRateFromBand(band, f) == null);

    if (!hasFilled) {
      setError('Enter a base rate first (e.g. Daily), then use Suggest fill');
      return;
    }

    if (!hasEmpty) {
      setError('All cells in this section already have values');
      return;
    }

    if (hasFilled && hasEmpty) {
      const ok = window.confirm(
        'Suggest fill will populate empty cells only. Continue?'
      );
      if (!ok) return;
    }

    const suggested = suggestFillFromLowerBand({
      rates: band,
      enabledFrequencies: frequencies,
      installmentCounts,
      overwriteFilled: false,
    });

    let filledAny = false;
    const existingBand = { ...band };
    for (const freq of frequencies) {
      const key = rateBandKeyForFrequency(freq);
      if (!key) continue;
      const existing = existingBand[key];
      const suggestedVal = suggested[key];
      if ((existing == null || existing <= 0) && suggestedVal != null && suggestedVal > 0) {
        existingBand[key] = suggestedVal;
        filledAny = true;
      }
    }

    if (!filledAny) {
      setError('Could not suggest values from the current base rate');
      return;
    }

    const nextPlans = {
      ...local.plans,
      [planKey]: {
        ...plan,
        rates: { ...plan.rates, [categoryKey]: existingBand },
      },
    };

    setLocal((prev) => ({ ...prev, plans: nextPlans }));
    setDirty(true);
    setError(null);
    recomputeSoftLossForBand(nextPlans, planKey, categoryKey);
  };

  const handleAddPlan = async () => {
    const name = toTitleCase(newPlanName);
    if (!name) {
      setError('Plan name is required');
      return;
    }

    setAddingPlan(true);
    setError(null);
    try {
      const token = await getSupabaseToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/plans`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-correlation-id': `plan-create-${Date.now()}`,
          },
          body: JSON.stringify({ name, isActive: true }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ?? `Failed to create plan: ${response.statusText}`
        );
      }

      const saved = await getPackagePricing(packageId);
      setLocal({ categories: saved.categories, plans: saved.plans });
      setNewPlanName('');
      setAddPlanOpen(false);
      onSaved(saved);
      onWarning?.(saved.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plan');
    } finally {
      setAddingPlan(false);
    }
  };

  const handleAddCategory = async () => {
    setAddingCategory(true);
    setError(null);
    try {
      const display =
        categoryDisplay.trim() ||
        (addCategoryKind === 'ADDITIONAL_SPOUSE'
          ? 'Additional spouse'
          : `Up to ${maxMembers}`);

      const body =
        addCategoryKind === 'UP_TO_N'
          ? {
              kind: 'UP_TO_N' as const,
              display,
              maxMembers: parseInt(maxMembers, 10),
            }
          : {
              kind: 'ADDITIONAL_SPOUSE' as const,
              display,
            };

      const result = await createPackagePricingCategory(packageId, body);
      setLocal((prev) => ({
        ...prev,
        categories: [...prev.categories, result.category],
      }));
      setAddCategoryOpen(false);
      setCategoryDisplay('');
      setMaxMembers('5');
      onWarning?.(result.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setAddingCategory(false);
    }
  };

  const softLossForCell = (planKey: string, categoryKey: string, frequency: string) =>
    softLossHints.find(
      (h) =>
        h.planKey === planKey &&
        h.categoryKey === categoryKey &&
        h.frequency === frequency
    );

  if (planEntries.length === 0) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            Add at least one plan before configuring pricing.
          </AlertDescription>
        </Alert>
        {!readOnly && (
          <Button onClick={() => setAddPlanOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        )}
        <AddPlanDialog
          open={addPlanOpen}
          onOpenChange={setAddPlanOpen}
          name={newPlanName}
          onNameChange={setNewPlanName}
          onSubmit={handleAddPlan}
          loading={addingPlan}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAddPlanOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add plan column
              </Button>
              {!hasUpToN && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddCategoryKind('UP_TO_N');
                    setAddCategoryOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Up to N
                </Button>
              )}
              {!hasSpouse && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddCategoryKind('ADDITIONAL_SPOUSE');
                    setAddCategoryOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add spouse
                </Button>
              )}
            </>
          )}
        </div>
        {!readOnly && (
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save pricing
          </Button>
        )}
      </div>

      {local.categories.map((category) => (
        <div key={category.key} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold">{category.display}</h3>
              <p className="text-xs text-muted-foreground">
                {category.kind === 'MEMBER_ONLY' && 'Member only'}
                {category.kind === 'UP_TO_N' &&
                  `Up to ${category.maxMembers ?? 'N'} members`}
                {category.kind === 'ADDITIONAL_SPOUSE' && 'Additional spouse'}
              </p>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Frequency</TableHead>
                  {planEntries.map(([planKey, plan]) => (
                    <TableHead key={planKey} className="min-w-[120px]">
                      <div className="flex flex-col gap-1">
                        <span>{plan.name}</span>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSuggestFill(planKey, category.key)}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Suggest fill
                          </Button>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {frequencies.map((frequency) => (
                  <TableRow key={frequency}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {frequencyRowLabel(frequency, installmentCounts[frequency])}
                    </TableCell>
                    {planEntries.map(([planKey]) => {
                      const isEditing =
                        editingCell?.planKey === planKey &&
                        editingCell.categoryKey === category.key &&
                        editingCell.frequency === frequency;

                      const amount = getCellAmount(
                        local.plans,
                        planKey,
                        category.key,
                        frequency
                      );
                      const baselineAmount = getCellAmount(
                        baselinePlans,
                        planKey,
                        category.key,
                        frequency
                      );
                      const isEdited = !amountsEqual(amount, baselineAmount);
                      const softLoss = softLossForCell(planKey, category.key, frequency);

                      return (
                        <TableCell
                          key={`${planKey}-${frequency}`}
                          className={`${!readOnly ? 'cursor-pointer' : ''} ${
                            isEditing ? 'bg-muted/50' : ''
                          }`}
                          onDoubleClick={() => {
                            if (readOnly) return;
                            setEditingCell({
                              planKey,
                              categoryKey: category.key,
                              frequency,
                              previousValue: amount,
                              draft: amount != null ? String(amount) : '',
                            });
                          }}
                        >
                          {isEditing && editingCell ? (
                            <div className="space-y-1 w-24">
                              {editingCell.previousValue != null && (
                                <span className="text-xs text-muted-foreground line-through block">
                                  {editingCell.previousValue}
                                </span>
                              )}
                              <Input
                                autoFocus
                                className="h-8 w-24 text-blue-600 font-semibold"
                                inputMode="decimal"
                                maxLength={8}
                                value={editingCell.draft}
                                onChange={(e) =>
                                  setEditingCell({
                                    ...editingCell,
                                    draft: e.target.value.replace(/[^\d.]/g, '').slice(0, 8),
                                  })
                                }
                                onBlur={() => commitEdit(editingCell)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitEdit(editingCell);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 min-w-[5.5rem]">
                              {isEdited && baselineAmount != null ? (
                                <span className="flex items-baseline gap-1">
                                  <span className="text-xs text-muted-foreground line-through">
                                    {baselineAmount}
                                  </span>
                                  <span className="text-blue-600 font-semibold">
                                    {amount ?? '—'}
                                  </span>
                                </span>
                              ) : isEdited ? (
                                <span className="text-amber-700 font-semibold">
                                  {amount ?? '—'}
                                </span>
                              ) : (
                                <span>{amount ?? '—'}</span>
                              )}
                              {softLoss && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-amber-600 inline-flex"
                                      aria-label={`Below floor (${softLoss.floorAmount}). Save is still allowed.`}
                                    >
                                      <AlertTriangle className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Below floor ({softLoss.floorAmount}). Save is still allowed.
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {dirty && !readOnly && (
        <p className="text-sm text-amber-700">You have unsaved pricing changes.</p>
      )}

      <AddPlanDialog
        open={addPlanOpen}
        onOpenChange={setAddPlanOpen}
        name={newPlanName}
        onNameChange={setNewPlanName}
        onSubmit={handleAddPlan}
        loading={addingPlan}
      />

      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addCategoryKind === 'UP_TO_N' ? 'Add Up to N category' : 'Add spouse category'}
            </DialogTitle>
            <DialogDescription>
              Optional pricing band for family sizes or additional spouse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {addCategoryKind === 'UP_TO_N' && (
              <div className="space-y-2">
                <Label htmlFor="maxMembers">Max members</Label>
                <Input
                  id="maxMembers"
                  inputMode="numeric"
                  value={maxMembers}
                  onChange={(e) =>
                    setMaxMembers(e.target.value.replace(/\D/g, '').slice(0, 2))
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="categoryDisplay">Display label</Label>
              <Input
                id="categoryDisplay"
                value={categoryDisplay}
                onChange={(e) => setCategoryDisplay(e.target.value)}
                placeholder={
                  addCategoryKind === 'ADDITIONAL_SPOUSE'
                    ? 'Additional spouse'
                    : `Up to ${maxMembers}`
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddCategoryOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCategory} disabled={addingCategory}>
                {addingCategory && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddPlanDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add plan</DialogTitle>
          <DialogDescription>
            Plan name becomes a pricing column (e.g. Silver, Gold).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="planName">Plan name</Label>
            <Input
              id="planName"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Silver"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
