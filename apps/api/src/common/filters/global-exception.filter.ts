import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';

import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Uniform error envelope for the API. Client code can rely on
 * `{ success: false, error: { code, message, details? } }` regardless of
 * which exception triggered the response.
 *
 * Stack traces are never serialised to the client — they are logged
 * server-side and forwarded to Sentry.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.normalise(exception);

    this.logger.error(
      {
        method: request.method,
        path: request.url,
        status,
        code,
        err: exception,
      },
      message,
    );

    response.status(status).json({
      success: false,
      error: { code, message, ...(details !== undefined && { details }) },
    });
  }

  private normalise(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return { status, code: this.codeFor(status), message: body };
      }
      const bodyObj = body as Record<string, unknown>;
      const rawError = bodyObj['error'];
      // Prefer a snake_case custom code if the caller supplied one; otherwise
      // use the status-based default. Nest's built-in exceptions set
      // `error` to a human-readable string (e.g. "Not Found"), which we skip.
      const explicitCode =
        typeof rawError === 'string' && /^[a-z0-9_]+$/.test(rawError) ? rawError : undefined;
      return {
        status,
        code: explicitCode ?? this.codeFor(status),
        message: typeof bodyObj['message'] === 'string' ? bodyObj['message'] : exception.message,
        details: Array.isArray(bodyObj['message']) ? bodyObj['message'] : undefined,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      message: 'Internal server error',
    };
  }

  private codeFor(status: number): string {
    switch (status) {
      case 400:
        return 'bad_request';
      case 401:
        return 'unauthorized';
      case 403:
        return 'forbidden';
      case 404:
        return 'not_found';
      case 409:
        return 'conflict';
      case 422:
        return 'unprocessable_entity';
      case 429:
        return 'rate_limited';
      case 503:
        return 'service_unavailable';
      default:
        return 'error';
    }
  }
}
