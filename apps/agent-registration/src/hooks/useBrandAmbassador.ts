import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface BrandAmbassadorInfo {
  id: string;
  userId: string;
  partnerId: number;
  displayName: string;
  phoneNumber?: string;
  perRegistrationRateCents: number;
  isActive: boolean;
}

export function useBrandAmbassador() {
  const { user } = useAuth();
  const [baInfo, setBaInfo] = useState<BrandAmbassadorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBaInfo(null);
      return;
    }

    // Check if we have cached BA info in localStorage
    const cachedBaInfo = localStorage.getItem('baInfo');
    if (cachedBaInfo) {
      try {
        const parsed = JSON.parse(cachedBaInfo);
        // Check if it's for the current user and not expired (cache for 1 hour)
        if (parsed.userId === user.id && parsed.cachedAt &&
            (Date.now() - parsed.cachedAt) < 3600000) {
          setBaInfo(parsed.data);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse cached BA info:', error);
      }
    }

    // Fetch BA info from API
    fetchBrandAmbassadorInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchBrandAmbassadorInfo = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getSupabaseToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/partner-management/brand-ambassadors/by-user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch BA info: ${response.status}`);
      }

      const baData = await response.json();

      // Cache the BA info
      const cacheData = {
        data: baData,
        userId: user.id,
        cachedAt: Date.now(),
      };
      localStorage.setItem('baInfo', JSON.stringify(cacheData));

      setBaInfo(baData);
    } catch (error) {
      console.error('Error fetching Brand Ambassador info:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch BA info');
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    localStorage.removeItem('baInfo');
    setBaInfo(null);
  };

  return {
    baInfo,
    loading,
    error,
    refetch: fetchBrandAmbassadorInfo,
    clearCache,
  };
}

async function getSupabaseToken(): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('No valid session found');
  }
  return session.access_token;
}
