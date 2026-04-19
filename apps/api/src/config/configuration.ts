/**
 * Typed configuration factory consumed by `ConfigModule.forRoot`. The shape
 * returned here is what the rest of the app sees via `ConfigService.get<T>()`.
 */
export interface AppConfig {
  env: 'development' | 'test' | 'production';
  name: string;
  appUrl: string;
  apiUrl: string;
  port: number;
  corsOrigins: string[];
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  database: {
    url: string;
    directUrl: string | undefined;
  };
  redis: {
    url: string;
    prefix: string;
  };
  throttle: {
    ttl: number;
    limit: number;
  };
  encryption: {
    key: string;
  };
  sentry: {
    dsn: string | undefined;
    environment: string;
  };
  auth: {
    jwtSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    bcryptCost: number;
    passwordResetTtlSeconds: number;
    emailVerifyTtlSeconds: number;
    invitationTtlSeconds: number;
  };
  mfa: {
    disableAllowed: boolean;
    tokenSecret: string;
    issuer: string;
    setupTokenTtlSeconds: number;
    challengeTokenTtlSeconds: number;
  };
  cookies: {
    domain: string;
    secure: boolean;
  };
  email: {
    resendApiKey: string | undefined;
    from: string;
    verifyUrlBase: string;
    resetUrlBase: string;
    invitationUrlBase: string;
  };
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

export const configuration = (): AppConfig => ({
  env: (process.env['NODE_ENV'] ?? 'development') as AppConfig['env'],
  name: process.env['APP_NAME'] ?? 'metaflow',
  appUrl: process.env['APP_URL'] ?? 'http://localhost:3000',
  apiUrl: process.env['API_URL'] ?? 'http://localhost:3001',
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  corsOrigins: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  logLevel: (process.env['LOG_LEVEL'] ?? 'info') as AppConfig['logLevel'],
  database: {
    url: process.env['DATABASE_URL'] ?? '',
    directUrl: process.env['DIRECT_URL'],
  },
  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    prefix: process.env['REDIS_PREFIX'] ?? 'metaflow:',
  },
  throttle: {
    ttl: parseInt(process.env['THROTTLE_TTL'] ?? '60', 10),
    limit: parseInt(process.env['THROTTLE_LIMIT'] ?? '100', 10),
  },
  encryption: {
    key: process.env['ENCRYPTION_KEY'] ?? '',
  },
  sentry: {
    dsn: process.env['SENTRY_DSN_API'] ?? undefined,
    environment: process.env['SENTRY_ENVIRONMENT'] ?? 'development',
  },
  auth: {
    jwtSecret: process.env['JWT_SECRET'] ?? '',
    accessTokenTtlSeconds: parseInt(process.env['ACCESS_TOKEN_TTL_SECONDS'] ?? '900', 10),
    refreshTokenTtlSeconds: parseInt(process.env['REFRESH_TOKEN_TTL_SECONDS'] ?? '604800', 10),
    bcryptCost: parseInt(process.env['BCRYPT_COST'] ?? '12', 10),
    passwordResetTtlSeconds: parseInt(
      process.env['PASSWORD_RESET_TOKEN_TTL_SECONDS'] ?? '3600',
      10,
    ),
    emailVerifyTtlSeconds: parseInt(process.env['EMAIL_VERIFY_TOKEN_TTL_SECONDS'] ?? '86400', 10),
    invitationTtlSeconds: parseInt(process.env['INVITATION_TTL_SECONDS'] ?? '604800', 10),
  },
  mfa: {
    disableAllowed: parseBool(process.env['MFA_DISABLE_ALLOWED'], false),
    tokenSecret: process.env['MFA_TOKEN_SECRET'] ?? '',
    issuer: process.env['MFA_ISSUER'] ?? 'Metaflow',
    setupTokenTtlSeconds: parseInt(process.env['MFA_SETUP_TOKEN_TTL_SECONDS'] ?? '300', 10),
    challengeTokenTtlSeconds: parseInt(process.env['MFA_CHALLENGE_TOKEN_TTL_SECONDS'] ?? '300', 10),
  },
  cookies: {
    domain: process.env['COOKIE_DOMAIN'] ?? 'localhost',
    secure: parseBool(process.env['COOKIE_SECURE'], false),
  },
  email: {
    resendApiKey: process.env['RESEND_API_KEY'] ?? undefined,
    from: process.env['EMAIL_FROM'] ?? 'noreply@metaflow.app',
    verifyUrlBase: process.env['EMAIL_VERIFY_URL_BASE'] ?? 'http://localhost:3000/verify-email',
    resetUrlBase: process.env['PASSWORD_RESET_URL_BASE'] ?? 'http://localhost:3000/reset-password',
    invitationUrlBase: process.env['INVITATION_URL_BASE'] ?? 'http://localhost:3000/invite/accept',
  },
});
