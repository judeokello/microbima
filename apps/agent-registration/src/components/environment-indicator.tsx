'use client';

import { useMemo, useState, useEffect } from 'react';

export function EnvironmentIndicator() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const environment = useMemo(() => {
    if (!mounted) return 'production'; // Match server render - no indicator until hydrated

    // Client-only: check environment based on URL
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      // Development environment (localhost)
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
        return 'development';
      }

      // Staging environment (staging domains)
      if (hostname.includes('staging') || hostname.includes('stg')) {
        return 'staging';
      }

      return 'production';
    }

    return 'production';
  }, [mounted]);

  // Don't show indicator for production or before mount (prevents hydration mismatch)
  if (!mounted || environment === 'production') {
    return null;
  }

  const getIndicatorStyles = () => {
    switch (environment) {
      case 'development':
        return 'bg-amber-600 text-white';
      case 'staging':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getIndicatorText = () => {
    switch (environment) {
      case 'development':
        return 'DEVELOPMENT';
      case 'staging':
        return 'STAGING';
      default:
        return 'UNKNOWN';
    }
  };

  return (
    <div className={`${getIndicatorStyles()} sticky top-0 w-full text-center py-1 text-xs font-medium tracking-wider z-50`}>
      {getIndicatorText()}
    </div>
  );
}
