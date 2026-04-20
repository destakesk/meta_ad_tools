import { afterEach } from 'vitest';

import { __resetMockCampaignStore } from '../../src/meta/mock-meta-api-client.js';

import { resetDb } from './helpers/db.js';
import { resetMailbox } from './helpers/mailbox.js';
import { resetRedis } from './helpers/redis.js';

/**
 * Runs after every test. Wipes mutable rows + redis keys + mailbox dumps
 * + mock-provider in-process state so each spec sees a known-clean world
 * without paying for fresh containers. The mock campaign store would
 * otherwise leak writes across tests that share a spec-file module scope.
 */
afterEach(async () => {
  await resetDb();
  await resetRedis();
  resetMailbox();
  __resetMockCampaignStore();
});
