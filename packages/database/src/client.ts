import { PrismaClient } from '../generated/client';

/**
 * Guarded Prisma singleton — avoids multi-client connection leaks under
 * Next.js / tsx hot reload by parking the instance on globalThis in non-prod.
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
