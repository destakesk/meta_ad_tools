import { PrismaClient, OrgRole, WorkspaceRole } from '@metaflow/database';
import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';

/**
 * One-shot dev helper: drops-or-upserts a ready-to-login admin user with
 * email already verified + MFA off. Prints the credentials when done.
 *
 * Usage:
 *   set -a && source .env && set +a && \
 *     pnpm --filter @metaflow/api exec tsx scripts/seed-demo-admin.ts
 */

const EMAIL = 'demo@metaflow.local';
const PASSWORD = 'DemoPass123!';
const DISPLAY_NAME = 'Demo Admin';
const ORG_NAME = 'Demo Organization';
const WORKSPACE_SLUG = 'demo';
const WORKSPACE_NAME = 'Demo Workspace';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
    const user = existing
      ? await prisma.user.update({
          where: { email: EMAIL },
          data: {
            passwordHash,
            emailVerifiedAt: new Date(),
            mfaEnabledAt: null,
            mfaSecret: null,
            mfaBackupCodes: [],
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        })
      : await prisma.user.create({
          data: {
            email: EMAIL,
            passwordHash,
            fullName: DISPLAY_NAME,
            emailVerifiedAt: new Date(),
          },
        });

    let org = await prisma.organization.findFirst({
      where: { memberships: { some: { userId: user.id } } },
    });
    if (!org) {
      org = await prisma.organization.create({
        data: { name: ORG_NAME, slug: 'demo-org' },
      });
      await prisma.organizationMembership.create({
        data: { organizationId: org.id, userId: user.id, role: OrgRole.OWNER },
      });
    }

    let workspace = await prisma.workspace.findFirst({
      where: { organizationId: org.id },
    });
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: { organizationId: org.id, slug: WORKSPACE_SLUG, name: WORKSPACE_NAME },
      });
    }

    const wsMembership = await prisma.workspaceMembership.findFirst({
      where: { workspaceId: workspace.id, userId: user.id },
    });
    if (!wsMembership) {
      await prisma.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceRole.ADMIN,
        },
      });
    }

    // ---- Finish MFA setup via the live API so login returns an access token ----
    const apiBase = process.env['API_URL'] ?? 'http://localhost:3001';
    const totpSecret = await completeMfaSetup(apiBase);

    console.warn('\n=== Demo admin ready ===');
    console.warn(`Email:        ${EMAIL}`);
    console.warn(`Password:     ${PASSWORD}`);
    console.warn(`Workspace:    /${workspace.slug}  (${workspace.name})`);
    console.warn(`TOTP secret:  ${totpSecret}`);
    console.warn(`Current code: ${authenticator.generate(totpSecret)}`);
    console.warn(`URL:          http://localhost:3000/login`);
  } finally {
    await prisma.$disconnect();
  }
}

async function completeMfaSetup(apiBase: string): Promise<string> {
  const loginRes = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'metaflow-web',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody = (await loginRes.json()) as {
    success: boolean;
    data?: { step?: string; mfaSetupToken?: string };
  };
  if (!loginBody.success || loginBody.data?.step !== 'mfa_setup_required') {
    throw new Error(`login did not request mfa setup: ${JSON.stringify(loginBody)}`);
  }
  const mfaSetupToken = loginBody.data.mfaSetupToken as string;

  const initRes = await fetch(
    `${apiBase}/api/auth/mfa/setup/init?mfaSetupToken=${encodeURIComponent(mfaSetupToken)}`,
    { headers: { 'x-requested-with': 'metaflow-web', origin: 'http://localhost:3000' } },
  );
  const initBody = (await initRes.json()) as {
    success: boolean;
    data?: { secret?: string };
  };
  const secret = initBody.data?.secret;
  if (!secret) throw new Error(`mfa init failed: ${JSON.stringify(initBody)}`);

  const totpCode = authenticator.generate(secret);
  const completeRes = await fetch(`${apiBase}/api/auth/mfa/setup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'metaflow-web',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ mfaSetupToken, totpCode }),
  });
  const completeBody = (await completeRes.json()) as { success: boolean; error?: unknown };
  if (!completeBody.success) {
    throw new Error(`mfa setup complete failed: ${JSON.stringify(completeBody)}`);
  }
  return secret;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
