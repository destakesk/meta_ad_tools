import { ChangePasswordForm } from './change-password-form';
import { MfaSection } from './mfa-section';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Güvenlik • metaflow' };

export default function SecurityPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Güvenlik</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Şifre, iki adımlı doğrulama ve yedek kodlar.
        </p>
      </header>
      <ChangePasswordForm />
      <MfaSection />
    </div>
  );
}
