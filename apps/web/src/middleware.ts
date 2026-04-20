import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/mfa/',
  '/invite/accept',
  '/status',
  '/api/',
  '/_next/',
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/login' || pathname === '/register' || pathname === '/status') return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Edge middleware combining two responsibilities:
 *   1. Emit a per-request CSP nonce (set on both request + response headers).
 *   2. Protect non-public routes — if the refresh cookie is absent, redirect
 *      to /login?redirect=<encoded original>. Authoritative verification
 *      happens in server components; this is only a cheap first-line gate.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const { pathname, search } = request.nextUrl;

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:3001 https://*.sentry.io",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // upgrade-insecure-requests is only safe outside dev — locally it
    // forces the browser to rewrite http://localhost links to https,
    // which then fails because there's no TLS listener on 3000.
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  // Auth gate — cheap cookie-presence check only.
  if (!isPublicPath(pathname)) {
    const hasRefresh = request.cookies.has('metaflow_refresh');
    if (!hasRefresh) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', cspDirectives);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
