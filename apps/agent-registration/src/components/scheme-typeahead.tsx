'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listSchemesForPicker, type Scheme } from '@/lib/api';
import { isSchemeTypeaheadQueryReady } from '@/lib/duplicate-person';

interface SchemeTypeaheadProps {
  label?: string;
  selected: Scheme | null;
  onSelect: (scheme: Scheme | null) => void;
  disabled?: boolean;
}

export default function SchemeTypeahead({
  label = 'Scheme',
  selected,
  onSelect,
  disabled = false,
}: SchemeTypeaheadProps) {
  const [query, setQuery] = useState(selected?.name ?? '');
  const [results, setResults] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected) {
      setQuery(selected.name);
    }
  }, [selected]);

  useEffect(() => {
    if (selected && query === selected.name) {
      setResults([]);
      return;
    }
    if (!isSchemeTypeaheadQueryReady(query)) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      void listSchemesForPicker(query.trim())
        .then((schemes) => {
          if (!cancelled) setResults(schemes.filter((s) => s.isActive !== false));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, selected]);

  return (
    <div className="relative">
      <Label htmlFor="scheme-typeahead">{label} *</Label>
      <Input
        id="scheme-typeahead"
        value={query}
        disabled={disabled}
        placeholder="Type at least 2 letters"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (selected && e.target.value !== selected.name) {
            onSelect(null);
          }
        }}
      />
      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-xs text-muted-foreground mt-1">Type at least 2 letters to search.</p>
      )}
      {open && isSchemeTypeaheadQueryReady(query) && !selected && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {loading && <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matching schemes</p>
          )}
          {!loading &&
            results.map((scheme) => (
              <button
                key={scheme.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(scheme);
                  setQuery(scheme.name);
                  setOpen(false);
                }}
              >
                {scheme.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
