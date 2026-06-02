import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-portal-display',
});

/**
 * Customer self-service shell (`/self/customer/**`).
 * Heritage display font (Plus Jakarta Sans) + Inter body from root layout (T021).
 */
export default function CustomerSelfServiceLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`min-h-screen bg-[#f9f9fd] text-[#1a1c1f] ${display.variable}`}>
      {children}
    </div>
  )
}
