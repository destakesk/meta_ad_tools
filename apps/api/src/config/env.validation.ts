import * as Joi from 'joi';

/**
 * Joi schema for runtime environment. `ConfigModule.forRoot` runs this at boot
 * — missing or malformed values cause the process to exit before the HTTP
 * server binds to a port.
 */
const base64_32Bytes = Joi.string()
  .base64()
  .custom((value: string, helpers) => {
    const bytes = Buffer.from(value, 'base64').length;
    if (bytes !== 32) {
      return helpers.error('any.invalid', {
        message: `must decode to 32 bytes, got ${bytes.toString()}`,
      });
    }
    return value;
  });

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

  // Auth
  JWT_SECRET: base64_32Bytes.required(),
  ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().min(3600).default(604800),
  BCRYPT_COST: Joi.number().integer().min(10).max(14).default(12),
  PASSWORD_RESET_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(3600),
  EMAIL_VERIFY_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(86400),
  INVITATION_TTL_SECONDS: Joi.number().integer().min(60).default(604800),

  // MFA
  MFA_DISABLE_ALLOWED: Joi.alternatives(Joi.boolean(), Joi.string()).default(false),
  MFA_TOKEN_SECRET: base64_32Bytes.required(),
  MFA_ISSUER: Joi.string().default('Metaflow'),
  MFA_SETUP_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).max(600).default(300),
  MFA_CHALLENGE_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).max(600).default(300),

  ENCRYPTION_KEY: base64_32Bytes.required(),

  // Cookies
  COOKIE_DOMAIN: Joi.string().default('localhost'),
  COOKIE_SECURE: Joi.alternatives(Joi.boolean(), Joi.string()).when('NODE_ENV', {
    is: 'production',
    then: Joi.alternatives(Joi.boolean().valid(true), Joi.string().valid('true')),
    otherwise: Joi.alternatives(Joi.boolean(), Joi.string()).default(false),
  }),

  // Email
  RESEND_API_KEY: Joi.string().optional().allow(''),
  EMAIL_FROM: Joi.string().default('noreply@metaflow.app'),
  EMAIL_VERIFY_URL_BASE: Joi.string().uri().required(),
  PASSWORD_RESET_URL_BASE: Joi.string().uri().required(),
  INVITATION_URL_BASE: Joi.string().uri().required(),

  SENTRY_DSN_API: Joi.string().uri().optional().allow(''),
  SENTRY_ENVIRONMENT: Joi.string().default('development'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
}).unknown(true);
