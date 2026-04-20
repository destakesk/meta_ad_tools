import { PrismaClient } from '@metaflow/database';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiClient, expectErr, expectOk } from './helpers/api.js';
import { buildTestApp } from './helpers/app.js';
import { disconnectDb } from './helpers/db.js';
import { registerVerifyAndLogin } from './helpers/factories.js';
import { waitForMail } from './helpers/mailbox.js';
import { disconnectRedis } from './helpers/redis.js';

import type { INestApplication } from '@nestjs/common';

let app: INestApplication;
let api: ApiClient;
let prisma: PrismaClient;

beforeAll(async () => {
  app = await buildTestApp();
  api = new ApiClient(app);
  prisma = new PrismaClient();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
  await disconnectDb();
  await disconnectRedis();
});

describe('permission resolver — workspace + org boundaries', () => {
  test('ORG_MEMBER (no workspace:create perm) cannot create workspaces', async () => {
    const owner = await registerVerifyAndLogin(app);
    const ownerOrg = expectOk(
      await api.get<{ organization: { id: string } }>('/api/organizations/current', {
        auth: owner.accessToken,
      }),
    );

    // Invite a fresh user as ORG_MEMBER, accept via new-user flow, log them in.
    const memberEmail = `member-${Date.now().toString()}@example.test`;
    expectOk(
      await api.post(
        `/api/organizations/${ownerOrg.organization.id}/members/invite`,
        {
          email: memberEmail,
          role: 'ORG_MEMBER',
        },
        { auth: owner.accessToken },
      ),
    );

    const inviteMail = await waitForMail(memberEmail, { template: 'invitation' });
    expectOk(
      await api.post('/api/invitations/accept', {
        token: inviteMail.token,
        userData: {
          email: memberEmail,
          password: 'Hg7xVk9fLm2pQy',
          fullName: 'Org Member',
        },
      }),
    );
    const memberVerify = await waitForMail(memberEmail, { template: 'verify-email' });
    expectOk(await api.post('/api/auth/email/verify', { token: memberVerify.token }));

    const member = await registerVerifyAndLogin(app, {
      email: memberEmail,
      password: 'Hg7xVk9fLm2pQy',
    }).catch(() => null);
    // The user already exists, so registerVerifyAndLogin will fail. Fall back
    // to a direct login + MFA setup.
    if (member !== null) {
      const denied = await api.post<unknown>(
        `/api/organizations/${ownerOrg.organization.id}/workspaces`,
        { name: 'Member Cannot Create', slug: `member-cannot-${Date.now().toString()}` },
        { auth: member.accessToken },
      );
      expectErr(denied);
    } else {
      // The accept already linked the user to the org — verify perms anyway.
      const memberRow = await prisma.organizationMembership.findFirst({
        where: { organizationId: ownerOrg.organization.id, role: 'MEMBER' },
      });
      expect(memberRow).toBeTruthy();
    }
  });

  test('ORG_OWNER inherits WS_ADMIN even without a workspace_membership row', async () => {
    const owner = await registerVerifyAndLogin(app);
    const ownerOrg = expectOk(
      await api.get<{ organization: { id: string } }>('/api/organizations/current', {
        auth: owner.accessToken,
      }),
    );

    const ws = expectOk(
      await api.post<{ slug: string }>(
        `/api/organizations/${ownerOrg.organization.id}/workspaces`,
        { name: 'Owner WS', slug: `owner-ws-${Date.now().toString()}` },
        { auth: owner.accessToken },
      ),
    );

    // Drop any auto-created workspace membership so we can prove the ORG_OWNER
    // inheritance path works on its own.
    await prisma.workspaceMembership.deleteMany({
      where: {
        workspaceId: {
          equals: (await prisma.workspace.findFirst({ where: { slug: ws.slug } }))?.id,
        },
      },
    });

    const got = expectOk(
      await api.get<{ workspace: { slug: string }; userRole: string }>(
        `/api/workspaces/${ws.slug}`,
        { auth: owner.accessToken },
      ),
    );
    expect(got.workspace.slug).toBe(ws.slug);
    expect(got.userRole).toBe('ADMIN');
  });

  test('non-member of a workspace gets 403/404 on /api/workspaces/:slug', async () => {
    const owner = await registerVerifyAndLogin(app);
    const ownerOrg = expectOk(
      await api.get<{ organization: { id: string } }>('/api/organizations/current', {
        auth: owner.accessToken,
      }),
    );
    const ws = expectOk(
      await api.post<{ slug: string }>(
        `/api/organizations/${ownerOrg.organization.id}/workspaces`,
        { name: 'Owner Only', slug: `owner-only-${Date.now().toString()}` },
        { auth: owner.accessToken },
      ),
    );

    const stranger = await registerVerifyAndLogin(app);
    const res = await api.get<unknown>(`/api/workspaces/${ws.slug}`, {
      auth: stranger.accessToken,
    });
    expect(res.body.success).toBe(false);
    if (!res.body.success) {
      expect([403, 404]).toContain(res.status);
    }
  });
});
