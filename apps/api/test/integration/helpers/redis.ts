import IORedis from 'ioredis';

let client: IORedis | undefined;

function getClient(): IORedis {
  client ??= new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  return client;
}

/**
 * FLUSHDB on the test redis. Tests share one db so this is the simplest
 * isolation strategy; rate-limit + JTI blacklist + MFA setup state all clear.
 */
export async function resetRedis(): Promise<void> {
  await getClient().flushdb();
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = undefined;
  }
}
