import type { Request } from 'express';

/**
 * Resolves the client IP, preferring Cloudflare's CF-Connecting-IP, then the
 * first entry of X-Forwarded-For, then req.ip.
 */
export function extractIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.length > 0) return cf;

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return req.ip ?? 'unknown';
}
