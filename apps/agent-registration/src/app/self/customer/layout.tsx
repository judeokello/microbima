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
      <header className="border-b border-transparent bg-[#f3f3f7]/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-center">
          <span className="text-lg font-semibold tracking-tight text-[#480054] font-[family-name:var(--font-portal-display)]">
            MaishaPoa
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-lg px-4 pb-8 text-center text-sm text-[#4f434e]">
        <p>Need help? Contact support using the numbers in your welcome message.</p>
      </footer>
    </div>
  )
}
