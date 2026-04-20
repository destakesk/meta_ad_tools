import request from 'supertest';

import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';

const HEADER = { 'X-Requested-With': 'metaflow-web' } as const;

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

/**
 * Thin HTTP helper. Each call sets the CSRF header that all state-changing
 * routes require, so test specs don't repeat the boilerplate.
 */
export class ApiClient {
  constructor(private readonly app: INestApplication) {}

  private server(): App {
    return this.app.getHttpServer() as App;
  }

  post<T>(path: string, body?: unknown, opts: { auth?: string; cookie?: string } = {}) {
    let req = request(this.server()).post(path).set(HEADER);
    if (opts.auth) req = req.set('Authorization', `Bearer ${opts.auth}`);
    if (opts.cookie) req = req.set('Cookie', opts.cookie);
    return req.send(body ?? {}) as unknown as Promise<{
      status: number;
      body: Envelope<T>;
      headers: Record<string, string | string[]>;
    }>;
  }

  get<T>(path: string, opts: { auth?: string; cookie?: string } = {}) {
    let req = request(this.server()).get(path).set(HEADER);
    if (opts.auth) req = req.set('Authorization', `Bearer ${opts.auth}`);
    if (opts.cookie) req = req.set('Cookie', opts.cookie);
    return req.send() as unknown as Promise<{
      status: number;
      body: Envelope<T>;
      headers: Record<string, string | string[]>;
    }>;
  }

  patch<T>(path: string, body?: unknown, opts: { auth?: string } = {}) {
    let req = request(this.server()).patch(path).set(HEADER);
    if (opts.auth) req = req.set('Authorization', `Bearer ${opts.auth}`);
    return req.send(body ?? {}) as unknown as Promise<{
      status: number;
      body: Envelope<T>;
      headers: Record<string, string | string[]>;
    }>;
  }

  del<T>(path: string, opts: { auth?: string } = {}) {
    let req = request(this.server()).delete(path).set(HEADER);
    if (opts.auth) req = req.set('Authorization', `Bearer ${opts.auth}`);
    return req.send() as unknown as Promise<{
      status: number;
      body: Envelope<T>;
      headers: Record<string, string | string[]>;
    }>;
  }
}

export function expectOk<T>(res: { status: number; body: Envelope<T> }): T {
  if (!res.body.success) {
    throw new Error(
      `Expected 2xx, got ${res.status.toString()} ${res.body.error.code}: ${res.body.error.message}`,
    );
  }
  return res.body.data;
}

/**
 * Asserts the response is an error envelope. The matcher accepts EITHER the
 * top-level `code` (HTTP-status-derived: forbidden, bad_request, …) OR the
 * snake_case `message` that auth services use as a logical error identifier
 * (`email_not_verified`, `invalid_credentials`, …). Most spec assertions
 * target the message, so callers usually pass that.
 */
export function expectErr<T>(res: { status: number; body: Envelope<T> }, codeOrMessage?: string) {
  if (res.body.success) {
    throw new Error(`Expected error, got success ${JSON.stringify(res.body.data)}`);
  }
  const { code, message } = res.body.error;
  if (codeOrMessage !== undefined && code !== codeOrMessage && message !== codeOrMessage) {
    throw new Error(`Expected error ${codeOrMessage}, got ${code} (${message})`);
  }
  return res.body.error;
}

export function getRefreshCookie(headers: Record<string, string | string[]>): string | undefined {
  const sc = headers['set-cookie'];
  const arr = Array.isArray(sc) ? sc : sc ? [sc] : [];
  const refresh = arr.find((c) => c.startsWith('metaflow_refresh='));
  if (!refresh) return undefined;
  return refresh.split(';')[0];
}
