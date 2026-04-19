import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailModule } from '../email/email.module.js';
import { AuditService } from './services/audit.service.js';
import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { MfaService } from './services/mfa.service.js';
import { PasswordService } from './services/password.service.js';
import { SessionService } from './services/session.service.js';
import { TokenService } from './services/token.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { CustomHeaderGuard } from './guards/custom-header.guard.js';
import { EmailVerifiedGuard } from './guards/email-verified.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionGuard } from './guards/permission.guard.js';
import { WorkspaceAccessGuard } from './guards/workspace-access.guard.js';

@Module({
  imports: [PassportModule.register({ session: false, defaultStrategy: 'jwt' }), EmailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    MfaService,
    SessionService,
    AuthRateLimitService,
    AuditService,
    JwtStrategy,
    JwtAuthGuard,
    EmailVerifiedGuard,
    WorkspaceAccessGuard,
    PermissionGuard,
    CustomHeaderGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    MfaService,
    SessionService,
    AuthRateLimitService,
    AuditService,
    JwtAuthGuard,
    EmailVerifiedGuard,
    WorkspaceAccessGuard,
    PermissionGuard,
    CustomHeaderGuard,
  ],
})
export class AuthModule {}
