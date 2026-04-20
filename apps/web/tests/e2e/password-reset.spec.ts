import { expect, test } from '@playwright/test';

import { E2E_PASSWORD, uniqueEmail } from './helpers/factories';
import { waitForMail } from './helpers/mailbox';

test('forgot-password → reset email → set new password → login with new', async ({
  page,
  request,
}) => {
  const email = uniqueEmail('reset');

  // Bootstrap a verified user via the API directly — quicker than re-driving
  // the signup UI in this scenario.
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
  const headers = { 'X-Requested-With': 'metaflow-web', 'Content-Type': 'application/json' };
  const reg = await request.post(`${apiBase}/api/auth/register`, {
    data: { email, password: E2E_PASSWORD, fullName: 'Reset Demo' },
    headers,
  });
  expect(reg.ok()).toBe(true);
  const verifyMail = await waitForMail(email, { template: 'verify-email' });
  const verify = await request.post(`${apiBase}/api/auth/email/verify`, {
    data: { token: verifyMail.token },
    headers,
  });
  expect(verify.ok()).toBe(true);

  // Drive the UI now.
  await page.goto('/forgot-password');
  await page.getByLabel('E-posta').fill(email);
  await page.getByRole('button', { name: /sıfırlama bağlantısı/i }).click();
  await expect(page.getByText(/kontrol edin/i)).toBeVisible();

  const resetMail = await waitForMail(email, { template: 'password-reset' });

  const newPassword = 'Nx7@vKp!9mLq3rXt';
  await page.goto(`/reset-password?token=${encodeURIComponent(resetMail.token)}`);
  await page.getByLabel('Yeni şifre').fill(newPassword);
  await page.getByRole('button', { name: /şifreyi sıfırla/i }).click();

  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(newPassword);
  await page.getByRole('button', { name: /giriş yap/i }).click();
  // Either MFA setup (first login) or the dashboard — both prove auth worked.
  await expect(page).toHaveURL(/\/(mfa\/setup|$)/, { timeout: 10_000 });
});
