/**
 * Prisma seed script — Module 01.
 *
 * No business data to seed yet. Inserts a single HealthCheck row so that
 * `prisma migrate reset` leaves the DB in a minimally-populated state.
 */
import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.healthCheck.create({
    data: {
      service: 'bootstrap',
      status: 'ok',
      latencyMs: 0,
      message: 'initial seed',
    },
  });

  console.warn('[seed] health_checks seeded');
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
