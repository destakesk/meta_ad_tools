import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import type { RequestUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!req.user) throw new ForbiddenException('auth_required');
    if (!req.user.emailVerifiedAt) throw new ForbiddenException('email_not_verified');
    return true;
  }
}
