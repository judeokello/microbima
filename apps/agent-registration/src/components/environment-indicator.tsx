'use client';

import { useMemo } from 'react';

export function EnvironmentIndicator() {
  const environment = useMemo(() => {
    // Check environment based on URL or environment variables
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

      // Production environment (no indicator needed)
      return 'production';
    }

    // Server-side: check environment variables
    if (process.env.NODE_ENV === 'development') {
      return 'development';
    }

    // Default to production for safety
    return 'production';
  }, []);

  // Don't show indicator for production
  if (environment === 'production') {
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
