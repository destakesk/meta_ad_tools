import { Button } from '@react-email/components';
import * as React from 'react';

export function CtaButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Button
      href={href}
      className="mt-6 inline-block rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white no-underline"
    >
      {children}
    </Button>
  );
}
