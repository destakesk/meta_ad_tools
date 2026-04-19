import type { NextConfig } from 'next';

/**
 * Next.js config — Module 01.
 *
 * Security headers other than CSP are set here; the per-request CSP nonce
 * is emitted from `src/middleware.ts` since it has to change each request.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // ESLint runs via `pnpm lint` (flat config). Next's legacy lint integration
  // doesn't fully understand our flat-config setup, so skip it at build time.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=15552000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
