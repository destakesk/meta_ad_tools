import { headers } from 'next/headers';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'metaflow',
  description: 'Meta Ads management platform',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <Providers>
          {children}
          {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
        </Providers>
      </body>
    </html>
  );
}
