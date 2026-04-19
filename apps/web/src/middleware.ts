import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware — emits a per-request Content Security Policy nonce and
 * forwards it both to the response (so scripts can opt in) and to the request
 * headers (so server components can read it via `headers()`).
 *
 * `'strict-dynamic'` lets any script loaded by a nonce'd script run without
 * needing its own hash, at the cost of requiring modern browsers (accepted).
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === 'development';

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'", // tailwind ships inline styles; scoped to self
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:3001 https://*.sentry.io",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', cspDirectives);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('content-security-policy', cspDirectives);
  return response;
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}

export const config = {
  matcher: [
    // Apply on everything except static assets and favicon.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
