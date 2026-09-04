'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listSchemesForPicker, type Scheme } from '@/lib/api';
import { schemeSearchQueryReady } from '@/lib/scheme-search';

interface SchemeTypeaheadProps {
  value?: number;
  selectedName?: string;
  onSelect: (scheme: Scheme) => void;
  disabled?: boolean;
}

export default function SchemeTypeahead({
  value,
  selectedName,
  onSelect,
  disabled,
}: SchemeTypeaheadProps) {
  const [query, setQuery] = useState(selectedName ?? '');
  const [results, setResults] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedName && value) {
      setQuery(selectedName);
    }
  }, [selectedName, value]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!schemeSearchQueryReady(trimmed)) {
      setResults([]);
      return;
    }
    if (selectedName && trimmed === selectedName) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      void listSchemesForPicker(trimmed)
        .then((rows) => {
          if (!cancelled) setResults(rows.filter((s) => s.isActive !== false));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, selectedName]);

  return (
    <div className="relative">
      <Label htmlFor="scheme-typeahead">Scheme *</Label>
      <Input
        id="scheme-typeahead"
        value={query}
        disabled={disabled}
        placeholder="Type at least 2 letters"
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {loading && <p className="text-xs text-muted-foreground mt-1">Searching…</p>}
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background shadow">
          {results.map((scheme) => (
            <li key={scheme.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setQuery(scheme.name);
                  setResults([]);
                  onSelect(scheme);
                }}
              >
                {scheme.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-xs text-muted-foreground mt-1">Keep typing to search schemes.</p>
      )}
    </div>
  );
}
