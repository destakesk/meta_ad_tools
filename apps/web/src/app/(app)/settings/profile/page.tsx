import { ProfileForm } from './profile-form';

import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Profil • metaflow' };

export default function ProfilePage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Hesap bilgilerini buradan güncelleyebilirsin.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Kişisel bilgiler</CardTitle>
          <CardDescription>
            Ad-soyad ve avatar görünür. E-posta değişikliği şu an bu ekrandan yapılamaz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}
