import { PrismaClient } from '../generated/client/index.js';

/**
 * Guarded Prisma singleton.
 *
 * In production a single instance is sufficient. During Next.js / tsx hot
 * reload, a naive `new PrismaClient()` leaks connections because each module
 * reload spawns a new client. Parking the instance on `globalThis` in non-prod
 * environments keeps the pool stable.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
