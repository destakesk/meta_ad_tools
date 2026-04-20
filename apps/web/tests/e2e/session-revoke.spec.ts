import { expect, test } from '@playwright/test';

import { E2E_PASSWORD, uniqueEmail } from './helpers/factories';
import { waitForMail } from './helpers/mailbox';
import { totp } from './helpers/totp';

const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const headers = { 'X-Requested-With': 'metaflow-web', 'Content-Type': 'application/json' };

interface Envelope<T> {
  success: true;
  data: T;
}

test('UI session list shows the active session marked Bu cihaz', async ({ page, request }) => {
  // Bootstrap a verified, MFA-enabled user via the API.
  const email = uniqueEmail('sess');
  await request.post(`${apiBase}/api/auth/register`, {
    headers,
    data: { email, password: E2E_PASSWORD, fullName: 'Sessions Demo' },
  });
  const v = await waitForMail(email, { template: 'verify-email' });
  await request.post(`${apiBase}/api/auth/email/verify`, { headers, data: { token: v.token } });

  // Drive the UI through login → MFA so the session lives on the browser cookie.
  await page.goto('/login');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /giriş yap/i }).click();
  await expect(page).toHaveURL(/\/mfa\/setup/);

  const setupToken = new URL(page.url()).searchParams.get('token') ?? '';
  const init = (await (
    await request.get(
      `${apiBase}/api/auth/mfa/setup/init?mfaSetupToken=${encodeURIComponent(setupToken)}`,
      { headers },
    )
  ).json()) as Envelope<{ secret: string }>;

  await page.getByLabel('6 haneli kod').fill(totp(init.data.secret));
  await page.getByRole('button', { name: /doğrula ve etkinleştir/i }).click();
  await page.getByLabel(/yedek kodları güvenli bir yere/i).check();
  await page.getByRole('button', { name: /devam et/i }).click();

  await page.goto('/settings/sessions');
  await expect(page.getByText(/aktif oturumlar/i)).toBeVisible();
  await expect(page.getByText('Bu cihaz')).toBeVisible();
});
