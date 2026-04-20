import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import type { Request } from 'express';

/**
 * Lightweight CSRF defence: state-changing auth endpoints must carry
 * `X-Requested-With: metaflow-web`. Combined with SameSite=Lax cookies this
 * blocks form-POST-from-another-origin CSRF without needing a token.
 */
@Injectable()
export class CustomHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const header = req.headers['x-requested-with'];
    if (header !== 'metaflow-web') throw new ForbiddenException('csrf_required');
    return true;
  }
}
