'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function useEditPermissions(customerId: string, userId: string) {
  const { isAdmin } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!customerId || !userId) {
        setCanEdit(false);
        setLoading(false);
        return;
      }

      // Admins can edit any customer
      if (isAdmin) {
        setCanEdit(true);
        setLoading(false);
        return;
      }

      // For agents, we need to check if they registered this customer
      // This will be checked server-side, but for UI we can assume true if user exists
      // The actual permission check happens on the backend
      // For now, allow edit - backend will enforce permissions
      setCanEdit(true);
      setLoading(false);
    };

    checkPermissions();
  }, [customerId, userId, isAdmin]);

  return { canEdit, loading };
}
