'use client';

import { useId, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';

export interface SortablePlan {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

interface SortablePlansTableProps {
  packageId: number;
  plans: SortablePlan[];
  canReorder: boolean;
  canEdit: boolean;
  onEdit: (plan: SortablePlan) => void;
  onReordered: (plans: SortablePlan[]) => void;
  onReorderError?: (message: string) => void;
}

function PlanDragHandle({ id, disabled }: { id: number; disabled?: boolean }) {
  const { attributes, listeners } = useSortable({ id, disabled });

  return (
    <Button
      type="button"
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      disabled={disabled}
      className="text-muted-foreground size-7 hover:bg-transparent cursor-grab active:cursor-grabbing disabled:cursor-default"
      aria-label="Drag to reorder"
    >
      <GripVertical className="text-muted-foreground size-4" />
    </Button>
  );
}

function SortablePlanRow({
  plan,
  canReorder,
  canEdit,
  onEdit,
}: {
  plan: SortablePlan;
  canReorder: boolean;
  canEdit: boolean;
  onEdit: (plan: SortablePlan) => void;
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: plan.id,
    disabled: !canReorder,
  });

  return (
    <TableRow
      ref={setNodeRef}
      data-dragging={isDragging}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {canReorder && (
        <TableCell className="w-10 px-2">
          <PlanDragHandle id={plan.id} />
        </TableCell>
      )}
      <TableCell className="font-medium">{plan.name}</TableCell>
      <TableCell>{plan.description ?? '—'}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            plan.isActive
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-secondary text-secondary-foreground border-transparent'
          }
        >
          {plan.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(plan)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function SortablePlansTable({
  packageId,
  plans,
  canReorder,
  canEdit,
  onEdit,
  onReordered,
  onReorderError,
}: SortablePlansTableProps) {
  const sortableId = useId();
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );
  const dataIds = useMemo(() => plans.map((p) => p.id), [plans]);

  const persistOrder = async (nextPlans: SortablePlan[]) => {
    const previous = plans;
    onReordered(nextPlans);
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/product-management/packages/${packageId}/plans/reorder`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-correlation-id': `pkg-plans-reorder-${Date.now()}`,
          },
          body: JSON.stringify({ planIds: nextPlans.map((p) => p.id) }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const payload = (await response.json()) as { data: SortablePlan[] };
      onReordered(
        (payload.data ?? nextPlans).map((p, index) => ({
          ...p,
          sortOrder: p.sortOrder ?? index,
        }))
      );
    } catch (err) {
      onReordered(previous);
      onReorderError?.(err instanceof Error ? err.message : 'Failed to reorder plans');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canReorder || saving) return;
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const oldIndex = dataIds.indexOf(Number(active.id));
    const newIndex = dataIds.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const moved = arrayMove(plans, oldIndex, newIndex).map((plan, index) => ({
      ...plan,
      sortOrder: index,
    }));
    void persistOrder(moved);
  };

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          {canReorder && <TableHead className="w-10" />}
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
          {plans.map((plan) => (
            <SortablePlanRow
              key={plan.id}
              plan={plan}
              canReorder={canReorder}
              canEdit={canEdit}
              onEdit={onEdit}
            />
          ))}
        </SortableContext>
      </TableBody>
    </Table>
  );

  if (!canReorder) {
    return <div className="rounded-md border">{table}</div>;
  }

  return (
    <div className="rounded-md border">
      <DndContext
        id={sortableId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        {table}
      </DndContext>
      <p className="text-muted-foreground px-3 py-2 text-xs border-t">
        Drag rows to set the order used left-to-right in the pricing table below.
      </p>
    </div>
  );
}
