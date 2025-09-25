'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the first step of the wizard
    router.push('/register/customer');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Starting Registration...</h2>
        <p className="text-muted-foreground mt-2">Redirecting to customer form...</p>
      </div>
    </div>
  );
}

