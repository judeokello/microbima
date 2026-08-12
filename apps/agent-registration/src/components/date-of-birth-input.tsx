'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseIsoToLocalDate(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

function formatLocalToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplay(value: string | undefined): string {
  const date = parseIsoToLocalDate(value);
  if (!date) return '';
  return format(date, 'dd-MM-yyyy');
}

export interface DateOfBirthInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  maxDate?: string;
  minDate?: string;
  disabled?: boolean;
  className?: string;
}

export default function DateOfBirthInput({
  value,
  onChange,
  id = 'dateOfBirth',
  required = false,
  maxDate,
  minDate,
  disabled = false,
  className,
}: DateOfBirthInputProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoToLocalDate(value);
  const min = useMemo(() => parseIsoToLocalDate(minDate), [minDate]);
  const max = useMemo(
    () => parseIsoToLocalDate(maxDate) ?? new Date(),
    [maxDate]
  );

  const startMonth = useMemo(() => {
    if (min) return new Date(min.getFullYear(), 0, 1);
    return new Date(max.getFullYear() - 120, 0, 1);
  }, [min, max]);

  const endMonth = useMemo(() => {
    return new Date(max.getFullYear(), 11, 31);
  }, [max]);

  const display = formatDisplay(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-required={required}
          className={cn(
            'w-full justify-start text-left font-normal',
            !display && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {display || 'DD-MM-YYYY'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={enGB}
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected ?? max}
          startMonth={startMonth}
          endMonth={endMonth}
          disabled={(date) => {
            if (min && date < new Date(min.getFullYear(), min.getMonth(), min.getDate())) {
              return true;
            }
            if (date > new Date(max.getFullYear(), max.getMonth(), max.getDate())) {
              return true;
            }
            return false;
          }}
          onSelect={(date) => {
            if (!date) {
              onChange('');
              return;
            }
            onChange(formatLocalToIso(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
