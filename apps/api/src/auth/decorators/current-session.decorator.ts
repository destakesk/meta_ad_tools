import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Session } from '@metaflow/database';

export const CurrentSession = createParamDecorator((_: unknown, ctx: ExecutionContext): Session => {
  const req = ctx.switchToHttp().getRequest<{ session?: Session }>();
  if (!req.session)
    throw new Error('CurrentSession requires JwtRefreshGuard or a session-hydrating guard');
  return req.session;
});
