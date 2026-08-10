'use client';

import { useEffect, useState } from 'react';
import { getIsBootstrapUser } from '@/lib/api';
import { useAuth } from './useAuth';

export function useIsBootstrap() {
  const { user, loading: authLoading } = useAuth();
  const [isBootstrap, setIsBootstrap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsBootstrap(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getIsBootstrapUser()
      .then((value) => {
        if (!cancelled) {
          setIsBootstrap(value);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIsBootstrap(false);
          setError(err instanceof Error ? err.message : 'Failed to check bootstrap status');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isBootstrap, loading: authLoading || loading, error };
}
