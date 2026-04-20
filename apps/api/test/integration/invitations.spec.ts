import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectErr, expectOk } from './helpers/api.js';
import { buildTestApp } from './helpers/app.js';
import { disconnectDb } from './helpers/db.js';
import { registerAndVerify, registerVerifyAndLogin } from './helpers/factories.js';
import { waitForMail } from './helpers/mailbox.js';
import { disconnectRedis } from './helpers/redis.js';

import type { INestApplication } from '@nestjs/common';

let app: INestApplication;
let api: ApiClient;

beforeAll(async () => {
  app = await buildTestApp();
  api = new ApiClient(app);
});

afterAll(async () => {
  await app.close();
  await disconnectDb();
  await disconnectRedis();
});

describe('invitations', () => {
  test('preview returns inviter + organization + role', async () => {
    const owner = await registerVerifyAndLogin(app);
    const org = expectOk(
      await api.get<{ organization: { id: string; name: string } }>('/api/organizations/current', {
        auth: owner.accessToken,
      }),
    );

    const inviteEmail = `invitee-${Date.now().toString()}@example.test`;
    expectOk(
      await api.post(
        `/api/organizations/${org.organization.id}/members/invite`,
        {
          email: inviteEmail,
          role: 'ORG_MEMBER',
        },
        { auth: owner.accessToken },
      ),
    );
    const mail = await waitForMail(inviteEmail);

    const preview = expectOk(
      await api.get<{ email: string; organizationName: string; role: string; inviterName: string }>(
        `/api/invitations/preview?token=${encodeURIComponent(mail.token ?? '')}`,
      ),
    );
    expect(preview.email).toBe(inviteEmail);
    expect(preview.organizationName).toBe(org.organization.name);
    expect(preview.role).toBe('ORG_MEMBER');
  });

  test('accept with userData creates the user and joins the org', async () => {
    const owner = await registerVerifyAndLogin(app);
    const org = expectOk(
      await api.get<{ organization: { id: string } }>('/api/organizations/current', {
        auth: owner.accessToken,
      }),
    );

    const inviteEmail = `accept-new-${Date.now().toString()}@example.test`;
    expectOk(
      await api.post(
        `/api/organizations/${org.organization.id}/members/invite`,
        {
          email: inviteEmail,
          role: 'ORG_MEMBER',
        },
        { auth: owner.accessToken },
      ),
    );
    const mail = await waitForMail(inviteEmail);

    const accept = expectOk(
      await api.post<{ ok: true; requiresLogin?: boolean }>('/api/invitations/accept', {
        token: mail.token,
        userData: {
          email: inviteEmail,
          password: 'Hg7xVk9fLm2pQy',
          fullName: 'New User',
        },
      }),
    );
    expect(accept.ok).toBe(true);

    // Members list now contains the new user.
    const members = expectOk(
      await api.get<{ members: { email: string }[] }>(
        `/api/organizations/${org.organization.id}/members`,
        { auth: owner.accessToken },
      ),
    );
    expect(members.members.find((m) => m.email === inviteEmail)).toBeTruthy();
  });

  test('expired or unknown token surfaces a clean error', async () => {
    const res = await api.get<unknown>('/api/invitations/preview?token=clearly-not-a-real-token');
    expectErr(res);
  });

  test('accept without userData returns requiresLogin for existing accounts', async () => {
    const owner = await registerVerifyAndLogin(app);
    const org = expectOk(
      await api.get<{ organization: { id: string } }>('/api/organizations/current', {
        auth: owner.accessToken,
      }),
    );

    const existing = await registerAndVerify(app);

    expectOk(
      await api.post(
        `/api/organizations/${org.organization.id}/members/invite`,
        {
          email: existing.email,
          role: 'ORG_MEMBER',
        },
        { auth: owner.accessToken },
      ),
    );
    const mail = await waitForMail(existing.email);

    const res = expectOk(
      await api.post<{ ok: true; requiresLogin?: boolean }>('/api/invitations/accept', {
        token: mail.token,
      }),
    );
    expect(res.ok).toBe(true);
    expect(res.requiresLogin).toBe(true);
  });
});
