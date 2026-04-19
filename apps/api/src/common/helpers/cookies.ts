import type { Response } from 'express';

import type { AppConfig } from '../../config/configuration.js';

export const REFRESH_COOKIE = 'metaflow_refresh';
export const ACCESS_COOKIE = 'metaflow_access';

interface CookieOptions {
  domain: string;
  secure: boolean;
}

export function setRefreshCookie(
  res: Response,
  token: string,
  opts: CookieOptions,
  ttlSeconds: number,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: 'lax',
    domain: opts.domain,
    path: '/api/auth',
    maxAge: ttlSeconds * 1000,
  });
}

export function clearRefreshCookie(res: Response, opts: CookieOptions): void {
  res.cookie(REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: opts.secure,
    sameSite: 'lax',
    domain: opts.domain,
    path: '/api/auth',
    maxAge: 0,
  });
}

export function cookieOptionsFromConfig(config: AppConfig): CookieOptions {
  return { domain: config.cookies.domain, secure: config.cookies.secure };
}
