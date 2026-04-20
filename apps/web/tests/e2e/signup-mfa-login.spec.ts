import { expect, test } from '@playwright/test';

import { E2E_PASSWORD, uniqueEmail } from './helpers/factories';
import { waitForMail } from './helpers/mailbox';
import { totp } from './helpers/totp';

test.describe('signup → email verify → MFA setup → dashboard', () => {
  test('full happy-path lands on the authenticated home', async ({ page, request }) => {
    const email = uniqueEmail('signup');
    const fullName = 'Playwright Demo';

    await page.goto('/register');
    await page.getByLabel('Ad Soyad').fill(fullName);
    await page.getByLabel('E-posta').fill(email);
    await page.getByLabel('Şifre').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /kayıt ol/i }).click();

    await expect(page).toHaveURL(/\/verify-email/);

    const verifyMail = await waitForMail(email, { template: 'verify-email' });
    await page.goto(`/verify-email?token=${encodeURIComponent(verifyMail.token)}`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    await page.goto('/login');
    await page.getByLabel('E-posta').fill(email);
    await page.getByLabel('Şifre').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /giriş yap/i }).click();
    await expect(page).toHaveURL(/\/mfa\/setup/);

    // Read the MFA secret straight from the API so we can compute the TOTP.
    // The api endpoint is public; the mfaSetupToken is in the URL.
    const url = new URL(page.url());
    const setupToken = url.searchParams.get('token') ?? '';
    const initRes = await request.get(
      `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/api/auth/mfa/setup/init?mfaSetupToken=${encodeURIComponent(setupToken)}`,
      { headers: { 'X-Requested-With': 'metaflow-web' } },
    );
    expect(initRes.ok()).toBe(true);
    const init = (await initRes.json()) as {
      success: true;
      data: { secret: string };
    };

    await page.getByLabel('6 haneli kod').fill(totp(init.data.secret));
    await page.getByRole('button', { name: /doğrula ve etkinleştir/i }).click();
    await expect(page.getByText(/yedek kodları güvenli bir yere kaydet/i)).toBeVisible();
    await page.getByLabel(/yedek kodları güvenli bir yere/i).check();
    await page.getByRole('button', { name: /devam et/i }).click();

    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?$/, { timeout: 10_000 });
    await expect(page.getByText(/hoş geldin/i)).toBeVisible();
  });
});
