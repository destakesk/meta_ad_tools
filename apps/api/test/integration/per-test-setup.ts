import { afterEach } from 'vitest';

import { resetDb } from './helpers/db.js';
import { resetMailbox } from './helpers/mailbox.js';
import { resetRedis } from './helpers/redis.js';

/**
 * Runs after every test. Wipes mutable rows + redis keys + mailbox dumps so
 * each spec sees a known-clean state without paying for fresh containers.
 */
afterEach(async () => {
  await resetDb();
  await resetRedis();
  resetMailbox();
});
