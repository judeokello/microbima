import { SelfServiceHomeClient } from './_components/self-service-home-client';

/**
 * Generic member login (US1). Redirects existing customer sessions to home or PIN setup.
 */
export default function CustomerSelfServiceHomePage() {
  return (
    <div className="min-h-screen bg-[#f9f9fd]">
      <header className="border-b border-transparent bg-[#f3f3f7]/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-center">
          <span className="text-lg font-semibold tracking-tight text-[#480054] font-[family-name:var(--font-portal-display)]">
            MaishaPoa
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <SelfServiceHomeClient />
      </main>
      <footer className="mx-auto max-w-lg px-4 pb-8 text-center text-sm text-[#4f434e]">
        <p>Need help? Contact support using the numbers in your welcome message.</p>
      </footer>
    </div>
  );
}
