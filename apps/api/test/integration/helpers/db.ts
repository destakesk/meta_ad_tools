import { PrismaClient } from '@metaflow/database';

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

/**
 * Truncates every mutable table while preserving the seed catalogue
 * (permissions + role_permissions). Cheap because Postgres TRUNCATE is O(1).
 */
export async function resetDb(): Promise<void> {
  const c = getClient();
  await c.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_logs",
      "invitations",
      "sessions",
      "workspace_memberships",
      "organization_memberships",
      "workspaces",
      "organizations",
      "users"
    RESTART IDENTITY CASCADE;
  `);
}

export async function disconnectDb(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
