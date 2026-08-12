'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseIsoDate(value: string | undefined): {
  day: string;
  month: string;
  year: string;
} {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { day: '', month: '', year: '' };
  }
  const [year, month, day] = value.split('-');
  return { day, month, year };
}

function toIsoDate(day: string, month: string, year: string): string {
  if (!day || !month || !year) return '';
  return `${year}-${month}-${day}`;
}

function clampDay(day: string, month: string, year: string): string {
  if (!day || !month || !year) return day;
  const maxDay = daysInMonth(Number(year), Number(month));
  const dayNum = Number(day);
  if (!Number.isInteger(dayNum) || dayNum < 1) return day;
  if (dayNum > maxDay) return String(maxDay).padStart(2, '0');
  return day;
}

export interface DateOfBirthInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  maxDate?: string;
  minDate?: string;
  disabled?: boolean;
}

export default function DateOfBirthInput({
  value,
  onChange,
  id = 'dateOfBirth',
  required = false,
  maxDate,
  minDate,
  disabled = false,
}: DateOfBirthInputProps) {
  const { day, month, year } = parseIsoDate(value);

  const yearOptions = useMemo(() => {
    const maxYear = maxDate
      ? Number(maxDate.slice(0, 4))
      : new Date().getUTCFullYear();
    const minYear = minDate ? Number(minDate.slice(0, 4)) : maxYear - 120;
    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, [maxDate, minDate]);

  const dayOptions = useMemo(() => {
    const y = year ? Number(year) : 2000;
    const m = month ? Number(month) : 1;
    const count = month && year ? daysInMonth(y, m) : 31;
    return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'));
  }, [month, year]);

  const emitChange = (nextDay: string, nextMonth: string, nextYear: string) => {
    const clampedDay = clampDay(nextDay, nextMonth, nextYear);
    onChange(toIsoDate(clampedDay, nextMonth, nextYear));
  };

  return (
    <div className="grid grid-cols-3 gap-2" id={id}>
      <div className="space-y-1">
        <Label htmlFor={`${id}-day`} className="text-xs text-muted-foreground">
          Day{required ? ' *' : ''}
        </Label>
        <Select
          value={day || undefined}
          onValueChange={(nextDay) => emitChange(nextDay, month, year)}
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-day`} className="w-full">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            {dayOptions.map((d) => (
              <SelectItem key={d} value={d}>
                {Number(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${id}-month`} className="text-xs text-muted-foreground">
          Month{required ? ' *' : ''}
        </Label>
        <Select
          value={month || undefined}
          onValueChange={(nextMonth) => emitChange(day, nextMonth, year)}
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-month`} className="w-full">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${id}-year`} className="text-xs text-muted-foreground">
          Year{required ? ' *' : ''}
        </Label>
        <Select
          value={year || undefined}
          onValueChange={(nextYear) => emitChange(day, month, nextYear)}
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-year`} className="w-full">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
