import { Hr, Text } from '@react-email/components';
import * as React from 'react';

import { CtaButton } from './_shared/button.js';
import { Layout } from './_shared/layout.js';

export interface InvitationTemplateProps {
  inviterName: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
}

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Organization Admin',
  ORG_MEMBER: 'Organization Üye',
  WS_ADMIN: 'Workspace Admin',
  WS_MANAGER: 'Workspace Manager',
  WS_VIEWER: 'Workspace Viewer',
};

export function InvitationTemplate({
  inviterName,
  organizationName,
  role,
  acceptUrl,
}: InvitationTemplateProps): React.ReactElement {
  const roleLabel = ROLE_LABELS[role] ?? role;
  return (
    <Layout preview={`${inviterName} seni ${organizationName}'a davet etti — Metaflow`}>
      <Text className="mt-4 text-lg font-medium">Yeni bir davet!</Text>
      <Text className="mt-2 text-base leading-6 text-zinc-700">
        <strong>{inviterName}</strong>, seni <strong>{organizationName}</strong> organizasyonuna{' '}
        <strong>{roleLabel}</strong> olarak davet etti.
      </Text>
      <CtaButton href={acceptUrl}>Daveti kabul et</CtaButton>
      <Hr className="my-6 border-zinc-200" />
      <Text className="text-xs text-zinc-500">
        Bu davet 7 gün içinde geçerliliğini yitirir. Hesabın yoksa aynı link üzerinden hesap
        oluşturup daveti otomatik kabul edebilirsin.
      </Text>
    </Layout>
  );
}
