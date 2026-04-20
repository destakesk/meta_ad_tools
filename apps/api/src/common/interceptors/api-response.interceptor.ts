import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Wraps every successful response in `{ success: true, data: … }` to match
 * the shared `ApiResponse<T>` contract. Error envelopes are emitted by
 * `GlobalExceptionFilter` (`{ success: false, error: … }`).
 */
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<{ success: true; data: unknown }> {
    return next.handle().pipe(map((data: unknown) => ({ success: true, data })));
  }
}
