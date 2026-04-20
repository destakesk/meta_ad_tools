import { expect, test } from '@playwright/test';

import { E2E_PASSWORD, uniqueEmail } from './helpers/factories';
import { waitForMail } from './helpers/mailbox';
import { totp } from './helpers/totp';

import type { APIRequestContext } from '@playwright/test';

const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const headers = { 'X-Requested-With': 'metaflow-web', 'Content-Type': 'application/json' };

interface Envelope<T> {
  success: true;
  data: T;
}

async function bootstrapOwner(request: APIRequestContext): Promise<{
  email: string;
  accessToken: string;
  organizationId: string;
}> {
  const email = uniqueEmail('owner');
  const reg = await request.post(`${apiBase}/api/auth/register`, {
    headers,
    data: { email, password: E2E_PASSWORD, fullName: 'Invite Owner' },
  });
  expect(reg.ok()).toBe(true);
  const v = await waitForMail(email, { template: 'verify-email' });
  await request.post(`${apiBase}/api/auth/email/verify`, { headers, data: { token: v.token } });

  const login = (await (
    await request.post(`${apiBase}/api/auth/login`, {
      headers,
      data: { email, password: E2E_PASSWORD },
    })
  ).json()) as Envelope<{ step: 'mfa_setup_required'; mfaSetupToken: string }>;
  const init = (await (
    await request.get(
      `${apiBase}/api/auth/mfa/setup/init?mfaSetupToken=${encodeURIComponent(login.data.mfaSetupToken)}`,
      { headers },
    )
  ).json()) as Envelope<{ secret: string }>;
  const setup = (await (
    await request.post(`${apiBase}/api/auth/mfa/setup`, {
      headers,
      data: { mfaSetupToken: login.data.mfaSetupToken, totpCode: totp(init.data.secret) },
    })
  ).json()) as Envelope<{ accessToken: string }>;

  const org = (await (
    await request.get(`${apiBase}/api/organizations/current`, {
      headers: { ...headers, Authorization: `Bearer ${setup.data.accessToken}` },
    })
  ).json()) as Envelope<{ organization: { id: string } }>;

  return { email, accessToken: setup.data.accessToken, organizationId: org.data.organization.id };
}

test('invitation accept by a new user creates the account and joins the org', async ({
  page,
  request,
}) => {
  const owner = await bootstrapOwner(request);
  const inviteeEmail = uniqueEmail('invitee');

  const inv = await request.post(
    `${apiBase}/api/organizations/${owner.organizationId}/members/invite`,
    {
      headers: { ...headers, Authorization: `Bearer ${owner.accessToken}` },
      data: { email: inviteeEmail, role: 'ORG_MEMBER' },
    },
  );
  expect(inv.ok()).toBe(true);

  const inviteMail = await waitForMail(inviteeEmail, { template: 'invitation' });
  await page.goto(`/invite/accept?token=${encodeURIComponent(inviteMail.token)}`);
  await expect(page.getByText(/daveti kabul/i)).toBeVisible();

  // Click accept; for a new user the API returns user_required and the page
  // swaps to the inline register form.
  await page.getByRole('button', { name: /daveti kabul et/i }).click();
  await expect(page.getByText(/önce hesap oluştur/i)).toBeVisible();

  await page.getByLabel('Ad Soyad').fill('Invitee Person');
  await page.getByLabel('Şifre').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /kayıt ol/i }).click();

  await expect(page).toHaveURL(/\/verify-email/);
});
