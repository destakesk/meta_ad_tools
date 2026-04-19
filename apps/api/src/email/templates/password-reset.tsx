import { Hr, Text } from '@react-email/components';
import * as React from 'react';

import { CtaButton } from './_shared/button.js';
import { Layout } from './_shared/layout.js';

export interface PasswordResetTemplateProps {
  fullName: string;
  resetUrl: string;
}

export function PasswordResetTemplate({
  fullName,
  resetUrl,
}: PasswordResetTemplateProps): React.ReactElement {
  return (
    <Layout preview="Şifre sıfırlama — Metaflow">
      <Text className="mt-4 text-lg font-medium">Merhaba {fullName},</Text>
      <Text className="mt-2 text-base leading-6 text-zinc-700">
        Şifreni sıfırlamak için bir talep aldık. Aşağıdaki butona tıklayarak yeni bir şifre
        belirleyebilirsin. Bu talebi sen yapmadıysan, bu emaili yok sayabilirsin — mevcut şifren
        değişmedi.
      </Text>
      <CtaButton href={resetUrl}>Yeni şifre belirle</CtaButton>
      <Hr className="my-6 border-zinc-200" />
      <Text className="text-xs text-zinc-500">
        Bu link 1 saat içinde geçerliliğini yitirir. Şifre sıfırlama sonrasında tüm cihazlarındaki
        oturumlar kapatılır.
      </Text>
    </Layout>
  );
}
