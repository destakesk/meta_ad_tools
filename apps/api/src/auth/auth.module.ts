import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { MfaService } from './services/mfa.service.js';
import { PasswordService } from './services/password.service.js';
import { SessionService } from './services/session.service.js';
import { TokenService } from './services/token.service.js';

/**
 * Auth primitives — controllers, guards, strategies land in Phases 8–9.
 * This module exports the pure domain services so later layers can consume
 * them without circular imports.
 */
@Module({
  imports: [PassportModule.register({ session: false, defaultStrategy: 'jwt' })],
  providers: [PasswordService, TokenService, MfaService, SessionService, AuthRateLimitService],
  exports: [PasswordService, TokenService, MfaService, SessionService, AuthRateLimitService],
})
export class AuthModule {}
