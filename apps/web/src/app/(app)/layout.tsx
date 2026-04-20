import type { ReactNode } from 'react';

import { AppShell } from '@/components/app/app-shell';

export default function AppLayout({ children }: { children: ReactNode }): React.ReactElement {
  return <AppShell>{children}</AppShell>;
}
