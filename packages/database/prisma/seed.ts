/**
 * Prisma seed script.
 *
 * Idempotent:
 *   - Permission rows upserted by unique `key`.
 *   - RolePermission rows upserted by unique (roleName, permissionId).
 *   - HealthCheck: single bootstrap row so migrate reset leaves a non-empty DB.
 *
 * Validates that every key referenced in ROLE_PERMISSIONS exists in PERMISSIONS
 * before touching the DB — catches typos at seed-time, not at request-time.
 */
import { PrismaClient } from '../generated/client';
import { PERMISSIONS } from '../src/data/permissions';
import { ROLE_NAMES, ROLE_PERMISSIONS } from '../src/data/role-permissions';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const permissionKeys = new Set(PERMISSIONS.map((p) => p.key));

  for (const [role, keys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const key of keys) {
      if (!permissionKeys.has(key)) {
        throw new Error(`Role ${role} references unknown permission key: ${key}`);
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const perm of PERMISSIONS) {
      await tx.permission.upsert({
        where: { key: perm.key },
        update: { description: perm.description, scope: perm.scope },
        create: perm,
      });
    }

    const allPerms = await tx.permission.findMany({
      select: { id: true, key: true },
    });
    const byKey = new Map(allPerms.map((p) => [p.key, p.id]));

    for (const role of ROLE_NAMES) {
      const keys = ROLE_PERMISSIONS[role];
      for (const key of keys) {
        const permissionId = byKey.get(key);
        if (!permissionId) continue;
        await tx.rolePermission.upsert({
          where: { roleName_permissionId: { roleName: role, permissionId } },
          update: {},
          create: { roleName: role, permissionId },
        });
      }
    }
  });

  const permCount = await prisma.permission.count();
  const roleMapCount = await prisma.rolePermission.count();
  console.warn(
    `[seed] ${permCount.toString()} permissions, ${roleMapCount.toString()} role-permission mappings`,
  );

  const hcCount = await prisma.healthCheck.count();
  if (hcCount === 0) {
    await prisma.healthCheck.create({
      data: { service: 'bootstrap', status: 'ok', latencyMs: 0, message: 'initial seed' },
    });
    console.warn('[seed] health_checks bootstrap row inserted');
  }
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
