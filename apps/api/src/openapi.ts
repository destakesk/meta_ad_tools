import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

/**
 * Sets up /api/docs (Swagger UI) and /api/docs-json (OpenAPI JSON).
 * Disabled in production; enable there via a separate auth-gated mount when needed.
 */
export function setupOpenApi(app: INestApplication): void {
  if (process.env['NODE_ENV'] === 'production') return;

  const config = new DocumentBuilder()
    .setTitle('metaflow API')
    .setDescription('Internal API for metaflow — Module 02 auth surface.')
    .setVersion('0.2.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addCookieAuth('metaflow_refresh', { type: 'apiKey', in: 'cookie' }, 'refreshCookie')
    .addTag('auth', 'Register, login, MFA, refresh, logout, password, sessions')
    .addTag('users', 'Profile, MFA management')
    .addTag('organizations', 'Org / member / workspace management')
    .addTag('workspaces', 'Workspace resolution')
    .addTag('invitations', 'Invitation preview + accept (public)')
    .addTag('health', 'Liveness + readiness probes')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
