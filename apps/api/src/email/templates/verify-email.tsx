import { Hr, Text } from '@react-email/components';
import * as React from 'react';

import { CtaButton } from './_shared/button.js';
import { Layout } from './_shared/layout.js';

export interface VerifyEmailTemplateProps {
  fullName: string;
  verifyUrl: string;
}

export function VerifyEmailTemplate({
  fullName,
  verifyUrl,
}: VerifyEmailTemplateProps): React.ReactElement {
  return (
    <Layout preview="Email adresini doğrula — Metaflow">
      <Text className="mt-4 text-lg font-medium">Merhaba {fullName},</Text>
      <Text className="mt-2 text-base leading-6 text-zinc-700">
        Metaflow hesabın oluşturuldu. Aşağıdaki butona tıklayarak email adresini doğrulaman
        gerekiyor. Bu adım tamamlanmadan hesabına giriş yapamazsın.
      </Text>
      <CtaButton href={verifyUrl}>Email adresimi doğrula</CtaButton>
      <Hr className="my-6 border-zinc-200" />
      <Text className="text-xs text-zinc-500">
        Bu link 24 saat içinde geçerliliğini yitirir. Yeni link için giriş sayfasından "doğrulama
        emaili gönder" bağlantısını kullanabilirsin.
      </Text>
    </Layout>
  );
}
