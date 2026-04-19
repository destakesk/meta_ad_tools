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
  jwt: {
    secret: string | undefined;
    expiresIn: string;
  };
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
  jwt: {
    secret: process.env['JWT_SECRET'],
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  },
});
