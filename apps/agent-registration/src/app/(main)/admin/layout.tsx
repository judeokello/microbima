'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBAStatusCheck } from '@/hooks/useBAStatusCheck';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LogOut,
  User,
  LayoutDashboard,
  Search,
  Home,
  Users,
  UsersRound,
  Menu,
  Building2,
  Wallet,
  MessageSquare,
  Megaphone,
  FileCheck,
  FileSpreadsheet,
  Layers,
  ClipboardPen,
  FileText,
} from 'lucide-react';
import { ExpandableNavGroup } from '@/components/messaging/expandable-nav-group';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userMetadata, isAdmin, isCustomerCare, signOut, loading } = useAuth();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useBAStatusCheck();

  const isCampaignHistoryPath =
    !!pathname?.startsWith('/admin/campaigns') && !pathname?.startsWith('/admin/campaigns/compose');
  const canAccessAsCustomerCare = isCustomerCare && isCampaignHistoryPath;
  const canAccessAdminArea = isAdmin || canAccessAsCustomerCare;

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

  if (!user) {
    window.location.href = '/auth/login';
    return null;
  }

  if (!canAccessAdminArea) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access the admin dashboard.</p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const closeMobile = () => {
    if (isMobile) setSidebarOpen(false);
  };

  const SidebarContent = () => (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Admin Dashboard</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-300">
          <User className="h-4 w-4" />
          <span>{userMetadata?.displayName ?? user?.email}</span>
        </div>
      </div>

      <nav className="space-y-2">
        {isAdmin ? (
          <>
            <Link
              href="/admin"
              className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
                pathname === '/admin' ? 'bg-white/10' : ''
              }`}
              onClick={closeMobile}
            >
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/search"
              className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
                pathname === '/dashboard/search' ? 'bg-white/10' : ''
              }`}
              onClick={closeMobile}
            >
              <Search className="h-4 w-4 mr-2" />
              Find Customer
            </Link>
            <Link
              href="/admin/customers"
              className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
                pathname === '/admin/customers' ? 'bg-white/10' : ''
              }`}
              onClick={closeMobile}
            >
              <Users className="h-4 w-4 mr-2" />
              Customers
            </Link>
            <Link
              href="/admin/ba-management"
              className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
                pathname === '/admin/ba-management' ? 'bg-white/10' : ''
              }`}
              onClick={closeMobile}
            >
              <UsersRound className="h-4 w-4 mr-2" />
              Manage Agents
            </Link>
            <Link
              href="/admin/underwriters"
              className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
                pathname?.startsWith('/admin/underwriters') ? 'bg-white/10' : ''
              }`}
              onClick={closeMobile}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Underwriters
            </Link>
            <Link
              href="/admin/schemes"
              className={`flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors ${
                pathname?.startsWith('/admin/schemes') ? 'bg-white/10' : ''
              }`}
              onClick={closeMobile}
            >
              <Layers className="h-4 w-4 mr-2" />
              Schemes
            </Link>
          </>
        ) : null}

        <ExpandableNavGroup
          title="Messaging"
          pathname={pathname}
          onNavigate={closeMobile}
          items={
            isAdmin
              ? [
                  {
                    href: '/admin/messages',
                    label: 'Messages',
                    icon: MessageSquare,
                    match: (p) => !!p?.startsWith('/admin/messages'),
                  },
                  {
                    href: '/admin/campaigns',
                    label: 'Campaigns',
                    icon: Megaphone,
                    match: (p) => !!p?.startsWith('/admin/campaigns'),
                  },
                  {
                    href: '/admin/messaging-templates',
                    label: 'Templates',
                    icon: FileText,
                    match: (p) => !!p?.startsWith('/admin/messaging-templates'),
                  },
                ]
              : [
                  {
                    href: '/admin/campaigns',
                    label: 'Campaigns',
                    icon: Megaphone,
                    match: (p) =>
                      !!p?.startsWith('/admin/campaigns') &&
                      !p?.startsWith('/admin/campaigns/compose'),
                  },
                ]
          }
        />

        {isAdmin ? (
          <>
            <ExpandableNavGroup
              title="Utilities"
              pathname={pathname}
              onNavigate={closeMobile}
              items={[
                {
                  href: '/admin/mpesa-payments',
                  label: 'MPESA Payments',
                  icon: Wallet,
                  match: (p) => !!p?.startsWith('/admin/mpesa-payments'),
                },
                {
                  href: '/admin/member-number-reconciliation',
                  label: 'Member # Reconciliation',
                  icon: FileCheck,
                  match: (p) => p === '/admin/member-number-reconciliation',
                },
                {
                  href: '/dashboard/missing-information',
                  label: 'Missing Information',
                  icon: ClipboardPen,
                  match: (p) => p === '/dashboard/missing-information',
                },
                {
                  href: '/admin/lct-exports',
                  label: 'LCT Exports',
                  icon: FileSpreadsheet,
                  match: (p) => !!p?.startsWith('/admin/lct-exports'),
                },
              ]}
            />
            <Link
              href="/dashboard"
              className="flex items-center px-3 py-2 rounded-md hover:bg-white/10 transition-colors"
              onClick={closeMobile}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Agent Dashboard
            </Link>
          </>
        ) : null}
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
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4 text-white" style={{ backgroundColor: '#2D1B69' }}>
            <SheetHeader>
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Main navigation menu for the admin dashboard
              </SheetDescription>
            </SheetHeader>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      )}

      <aside className="hidden md:block w-64 text-white p-4" style={{ backgroundColor: '#2D1B69' }}>
        <SidebarContent />
      </aside>

      <main className="flex-1 p-6 bg-gray-100">
        {!isMobile && (
          <div className="mb-6">
            <Image
              src="/maishapoalogo1.png"
              alt="MaishaPoa Logo"
              width={180}
              height={60}
              priority
              style={{ height: 'auto' }}
              className="object-contain"
            />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
