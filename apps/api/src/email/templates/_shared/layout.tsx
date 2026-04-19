import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import * as React from 'react';

export interface LayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function Layout({ preview, children }: LayoutProps): React.ReactElement {
  return (
    <Html lang="tr">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-zinc-50 font-sans text-zinc-900">
          <Container className="mx-auto max-w-xl py-10">
            <Section className="rounded-xl border border-zinc-200 bg-white p-8">
              <Text className="text-2xl font-semibold tracking-tight text-zinc-900">metaflow</Text>
              {children}
            </Section>
            <Text className="mt-6 text-center text-xs text-zinc-500">
              Bu email otomatik gönderildi. Yanıtlamayın — ekiple iletişim için destek@metaflow.app.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
