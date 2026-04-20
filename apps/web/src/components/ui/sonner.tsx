'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps): React.ReactElement {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[hsl(var(--background))] group-[.toaster]:text-[hsl(var(--foreground))] group-[.toaster]:border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-[hsl(var(--muted-foreground))]',
          actionButton:
            'group-[.toast]:bg-[hsl(var(--primary))] group-[.toast]:text-[hsl(var(--primary-foreground))]',
          cancelButton:
            'group-[.toast]:bg-[hsl(var(--muted))] group-[.toast]:text-[hsl(var(--muted-foreground))]',
        },
      }}
      {...props}
    />
  );
}
