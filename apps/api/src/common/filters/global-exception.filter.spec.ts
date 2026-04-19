import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from './global-exception.filter.js';

function makeHost(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status } as unknown;
  const request = { method: 'GET', url: '/x' } as unknown;
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('maps NotFoundException to 404 with not_found code', () => {
    const { host, status, json } = makeHost();
    filter.catch(new NotFoundException('missing'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'not_found', message: 'missing' },
    });
  });

  it('maps BadRequestException array messages to details field', () => {
    const { host, status, json } = makeHost();
    filter.catch(new BadRequestException(['a is required', 'b must be int']), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const arg = json.mock.calls[0]?.[0] as { error: { details?: unknown } };
    expect(arg.error.details).toEqual(['a is required', 'b must be int']);
  });

  it('falls back to 500 internal_error for unknown throws', () => {
    const { host, status, json } = makeHost();
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'internal_error', message: 'Internal server error' },
    });
  });
});
