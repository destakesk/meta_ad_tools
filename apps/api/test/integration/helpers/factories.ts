import { ApiClient, expectOk, getRefreshCookie } from './api.js';
import { waitForMail } from './mailbox.js';
import { totp } from './totp.js';

import type { INestApplication } from '@nestjs/common';

interface RegisterArgs {
  email?: string;
  password?: string;
  fullName?: string;
}

interface RegisteredUser {
  email: string;
  password: string;
  userId: string;
}

const DEFAULT_PASSWORD = 'Hg7xVk9fLm2pQy';

let counter = 0;
function nextEmail(): string {
  counter += 1;
  return `user${counter.toString()}-${Date.now().toString()}@example.test`;
}

/**
 * Register a new user and complete email verification. Stops short of the
 * MFA setup so individual tests can drive the next step themselves.
 */
export async function registerAndVerify(
  app: INestApplication,
  args: RegisterArgs = {},
): Promise<RegisteredUser> {
  const api = new ApiClient(app);
  const email = args.email ?? nextEmail();
  const password = args.password ?? DEFAULT_PASSWORD;
  const fullName = args.fullName ?? 'Test User';

  const reg = expectOk(
    await api.post<{ userId: string }>('/api/auth/register', { email, password, fullName }),
  );
  const mail = await waitForMail(email);
  const token = mail.token ?? '';
  expectOk(await api.post('/api/auth/email/verify', { token }));

  return { email, password, userId: reg.userId };
}

interface LoggedInUser extends RegisteredUser {
  accessToken: string;
  refreshCookie: string;
  mfaSecret: string;
  backupCodes: string[];
}

/**
 * Full happy-path: register → verify email → login → MFA setup completion.
 * Returns the access token, refresh cookie, and MFA secret for follow-up
 * actions inside the test.
 */
export async function registerVerifyAndLogin(
  app: INestApplication,
  args: RegisterArgs = {},
): Promise<LoggedInUser> {
  const api = new ApiClient(app);
  const base = await registerAndVerify(app, args);

  const login = expectOk(
    await api.post<{ step: string; mfaSetupToken: string }>('/api/auth/login', {
      email: base.email,
      password: base.password,
    }),
  );
  if (login.step !== 'mfa_setup_required') {
    throw new Error(`Expected mfa_setup_required, got ${login.step}`);
  }

  const init = expectOk(
    await api.get<{ secret: string }>(
      `/api/auth/mfa/setup/init?mfaSetupToken=${encodeURIComponent(login.mfaSetupToken)}`,
    ),
  );

  const setupRes = await api.post<{ accessToken: string; backupCodes: string[] }>(
    '/api/auth/mfa/setup',
    {
      mfaSetupToken: login.mfaSetupToken,
      totpCode: totp(init.secret),
    },
  );
  const setup = expectOk(setupRes);
  const refreshCookie = getRefreshCookie(setupRes.headers);
  if (!refreshCookie) throw new Error('mfa/setup did not set refresh cookie');

  return {
    ...base,
    accessToken: setup.accessToken,
    backupCodes: setup.backupCodes,
    mfaSecret: init.secret,
    refreshCookie,
  };
}
