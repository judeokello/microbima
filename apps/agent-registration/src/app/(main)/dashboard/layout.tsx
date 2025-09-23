'use client'

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userMetadata, isBrandAmbassador, isAdmin, signOut, loading } = useAuth();

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

  if (!isBrandAmbassador) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access the dashboard.</p>
          {isAdmin && (
            <Button asChild>
              <Link href="/admin">Go to Admin Panel</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Dashboard Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-4">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">BA Dashboard</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <User className="h-4 w-4" />
            <span>{userMetadata?.displayName || user?.email}</span>
          </div>
        </div>

        <nav className="space-y-2">
          <Link 
            href="/dashboard" 
            className="block px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Dashboard
          </Link>
          <Link 
            href="/register" 
            className="block px-3 py-2 rounded-md hover:bg-gray-700 transition-colors bg-blue-600 hover:bg-blue-700"
          >
            Register Customer
          </Link>
          <Link 
            href="/dashboard/registrations" 
            className="block px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            My Registrations
          </Link>
          <Link 
            href="/dashboard/earnings" 
            className="block px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Earnings
          </Link>
          
          {/* Admin link - only visible if user has registration_admin role */}
          {isAdmin && (
            <Link 
              href="/admin" 
              className="block px-3 py-2 rounded-md hover:bg-gray-700 transition-colors bg-gray-700"
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Admin Panel
            </Link>
          )}
        </nav>

        <div className="mt-auto pt-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={signOut}
            className="w-full bg-transparent border-gray-600 text-white hover:bg-gray-700"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
            </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 bg-gray-100">
        {children}
      </main>
          </div>
  );
}