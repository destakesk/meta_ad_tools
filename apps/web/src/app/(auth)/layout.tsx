import Link from 'next/link';

import type { ReactNode } from 'react';

/**
 * Centered narrow layout shared by all unauthenticated routes
 * (login, register, MFA, password reset, email verification).
 */
export default function AuthLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          metaflow
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-6 sm:items-center sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-6 py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
        © {new Date().getFullYear()} metaflow
      </footer>
    </div>
  );
}
