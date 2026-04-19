import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';

describe('HealthController.live', () => {
  it('returns ok with timestamp + uptime', () => {
    const controller = new HealthController(
      { check: async () => ({ status: 'ok', info: {}, error: {}, details: {} }) } as never,
      {} as never,
      {} as never,
    );
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
