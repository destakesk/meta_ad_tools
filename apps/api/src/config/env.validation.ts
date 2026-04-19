import * as Joi from 'joi';

/**
 * Joi schema for runtime environment. NestJS `ConfigModule.forRoot` uses this
 * to validate env at boot — missing or malformed values cause the process to
 * exit before the HTTP server starts.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  APP_NAME: Joi.string().default('metaflow'),
  APP_URL: Joi.string().uri().required(),
  API_URL: Joi.string().uri().required(),
  PORT: Joi.number().port().default(3001),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  DIRECT_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .optional(),

  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  REDIS_PREFIX: Joi.string().default('metaflow:'),

  JWT_SECRET: Joi.string().min(32).optional(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // AES-256 key must decode to exactly 32 bytes.
  ENCRYPTION_KEY: Joi.string()
    .base64()
    .custom((value: string, helpers) => {
      const bytes = Buffer.from(value, 'base64').length;
      if (bytes !== 32) {
        return helpers.error('any.invalid', {
          message: `ENCRYPTION_KEY must decode to 32 bytes, got ${bytes}`,
        });
      }
      return value;
    })
    .required(),

  SENTRY_DSN_API: Joi.string().uri().optional().allow(''),
  SENTRY_ENVIRONMENT: Joi.string().default('development'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
});
