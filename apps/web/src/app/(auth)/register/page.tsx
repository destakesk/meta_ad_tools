import Link from 'next/link';

import type { Metadata } from 'next';

import { RegisterForm } from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Kayıt ol • metaflow' };

export default function RegisterPage(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hesap oluştur</CardTitle>
        <CardDescription>
          Yeni bir organizasyon ve workspace oluşturulur. Davetle gelmediyseniz buradan başlayın.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />
        <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
          Zaten hesabınız var mı?{' '}
          <Link href="/login" className="font-medium text-[hsl(var(--foreground))] hover:underline">
            Giriş yapın
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
