'use client'

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings, Search, Home, UserPlus, ClipboardList, Wallet } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userMetadata, isBrandAmbassador, isAdmin, signOut, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, redirect to login
  if (!user) {
    window.location.href = '/auth/login';
    return null;
  }

  // If user is authenticated but not authorized for dashboard
  if (!isBrandAmbassador) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access the dashboard.</p>
          {isAdmin && (
            <Button asChild>
              <Link href="/admin">Go to Admin Dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Dashboard Sidebar */}
      <aside className="w-64 text-white p-4" style={{ backgroundColor: '#2D1B69' }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Agent Dashboard</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <User className="h-4 w-4" />
            <span>{userMetadata?.displayName ?? user?.email}</span>
          </div>
        </div>

        <nav className="space-y-2">
          <Link
            href="/dashboard"
            className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
              pathname === '/dashboard' ? 'bg-white/10' : ''
            }`}
          >
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
          <Link
            href="/register"
            className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
              pathname?.startsWith('/register') ? 'bg-white/10' : ''
            }`}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Register Customer
          </Link>
          <Link
            href="/dashboard/registrations"
            className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
              pathname === '/dashboard/registrations' ? 'bg-white/10' : ''
            }`}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            My Registrations
          </Link>
          <Link
            href="/dashboard/earnings"
            className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
              pathname === '/dashboard/earnings' ? 'bg-white/10' : ''
            }`}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Earnings
          </Link>
          <Link
            href="/dashboard/search"
            className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
              pathname === '/dashboard/search' ? 'bg-white/10' : ''
            }`}
          >
            <Search className="h-4 w-4 mr-2" />
            Search Customer
          </Link>

          {/* Admin link - only visible if user has registration_admin role */}
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors"
            >
              <Settings className="h-4 w-4 mr-2" />
              Admin Dashboard
            </Link>
          )}
        </nav>

        <div className="mt-6 space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="w-full bg-transparent border-white/20 text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
          <div className="flex justify-center px-2">
            <Image
              src="/maishapoalogo1.png"
              alt="MaishaPoa Logo"
              width={200}
              height={60}
              className="object-contain w-full"
            />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 bg-gray-100">
        <div className="mb-6">
          <Image
            src="/maishapoalogo1.png"
            alt="MaishaPoa Logo"
            width={180}
            height={60}
            className="object-contain"
          />
        </div>
        {children}
      </main>
          </div>
  );
}