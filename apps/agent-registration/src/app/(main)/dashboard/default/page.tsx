'use client';

import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { SectionCards } from "./_components/section-cards";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface BrandAmbassadorDashboardStats {
  registeredToday: number;
  registeredYesterday: number;
  registeredThisWeek: number;
  registeredLastWeek: number;
  myTotalRegistrations: number;
}

export default function Page() {
  const [stats, setStats] = useState<BrandAmbassadorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('No session found');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_INTERNAL_API_BASE_URL}/internal/customers/my-dashboard-stats`, {
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'x-correlation-id': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      {/* Header with Register Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to your dashboard. Track your registrations and earnings.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={fetchDashboardStats} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/register">
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" />
              Register New Customer
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      <SectionCards stats={stats} loading={loading} formatNumber={formatNumber} />
      <ChartAreaInteractive />
    </div>
  );
}
