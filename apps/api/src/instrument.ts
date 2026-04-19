/**
 * Sentry bootstrap — imported first in `main.ts` (before any other module) so
 * that the SDK can install its async-hooks-based instrumentation early.
 *
 * Behaviour:
 *   - Performance tracing is off (`tracesSampleRate: 0`) per Module 01 scope.
 *   - PII is not sent by default (`sendDefaultPii: false`).
 *   - A `beforeSend` hook scrubs common leak vectors in request headers.
 *   - If `SENTRY_DSN_API` is unset, `init()` is a no-op.
 */
import * as Sentry from '@sentry/node';

const dsn = process.env['SENTRY_DSN_API'];
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: process.env['SENTRY_ENVIRONMENT'] ?? 'development',
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string | undefined>;
        delete h['authorization'];
        delete h['cookie'];
        delete h['set-cookie'];
        delete h['x-api-key'];
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
