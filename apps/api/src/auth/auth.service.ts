import { InvitationStatus, OrgRole, WorkspaceRole } from '@metaflow/database';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CryptoService } from '../crypto/crypto.service.js';
import { EmailService } from '../email/email.service.js';
import { PermissionResolver } from '../permissions/permission-resolver.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

import { AuditService } from './services/audit.service.js';
import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { MfaService } from './services/mfa.service.js';
import { PasswordService } from './services/password.service.js';
import { SessionService } from './services/session.service.js';
import { TokenService } from './services/token.service.js';

import type { AppConfig } from '../config/configuration.js';
import type { Prisma } from '@metaflow/database';
import type { AuditMetadata, LoginResponse } from '@metaflow/shared-types';

export interface RequestContext {
  ip: string | undefined;
  userAgent: string | undefined;
}

const LOCKOUT_WINDOW_SECONDS = 15 * 60;
const LOCKOUT_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mfa: MfaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly crypto: CryptoService,
    private readonly email: EmailService,
    private readonly resolver: PermissionResolver,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ---------- Register ----------

  async register(
    input: { email: string; password: string; fullName: string; invitationToken?: string },
    ctx: RequestContext,
  ): Promise<{ userId: string; emailVerificationRequired: true }> {
    const normalisedEmail = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalisedEmail },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('email_already_registered');

    const strength = await this.passwords.validateStrength({
      password: input.password,
      email: normalisedEmail,
      fullName: input.fullName,
    });
    if (!strength.ok)
      throw new BadRequestException({
        message: strength.feedback ?? 'weak_password',
        code: 'weak_password',
      });

    const passwordHash = await this.passwords.hash(input.password);

    // Opaque email verify token — SHA-256 hashed in DB.
    const verifyToken = this.tokens.generateOpaqueToken();
    const verifyHash = this.tokens.hashOpaqueToken(verifyToken);
    const authCfg = this.config.get('auth', { infer: true });

    const slug = this.slugifyFullName(input.fullName);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalisedEmail,
          passwordHash,
          fullName: input.fullName,
          emailVerifyToken: verifyHash,
          emailVerifyExpiresAt: new Date(Date.now() + authCfg.emailVerifyTtlSeconds * 1000),
        },
      });

      if (input.invitationToken) {
        await this.acceptInvitationInTransaction(tx, user.id, input.invitationToken);
      } else {
        // Fresh user: create a solo Organization + default Workspace.
        const orgSlug = await this.uniqueSlug(tx, slug, 'organization');
        const org = await tx.organization.create({
          data: { name: input.fullName, slug: orgSlug },
        });
        await tx.organizationMembership.create({
          data: { organizationId: org.id, userId: user.id, role: OrgRole.OWNER },
        });
        const wsSlug = await this.uniqueSlug(tx, 'default', 'workspace', org.id);
        const ws = await tx.workspace.create({
          data: { organizationId: org.id, name: 'Default Workspace', slug: wsSlug },
        });
        await tx.workspaceMembership.create({
          data: { workspaceId: ws.id, userId: user.id, role: WorkspaceRole.ADMIN },
        });
      }

      return user;
    });

    await this.email.enqueueVerifyEmail({
      to: normalisedEmail,
      fullName: input.fullName,
      token: verifyToken,
      locale: 'tr',
    });

    await this.audit.record({
      action: 'auth.register',
      userId: result.id,
      metadata: this.meta(ctx),
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { userId: result.id, emailVerificationRequired: true };
  }

  // ---------- Login ----------

  async login(
    input: { email: string; password: string },
    ctx: RequestContext,
  ): Promise<LoginResponse> {
    const normalisedEmail = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalisedEmail } });

    if (!user || user.deletedAt) {
      await this.recordFailedLogin(normalisedEmail, 'user_not_found', null, ctx);
      throw new UnauthorizedException('invalid_credentials');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.audit.record({
        action: 'login.locked',
        userId: user.id,
        metadata: { reason: 'locked', ...this.meta(ctx) },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new ForbiddenException('account_locked');
    }

    const passwordOk = await this.passwords.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      await this.recordFailedLogin(normalisedEmail, 'wrong_password', user.id, ctx);
      throw new UnauthorizedException('invalid_credentials');
    }

    if (!user.emailVerifiedAt) {
      await this.audit.record({
        action: 'login.failed',
        userId: user.id,
        metadata: { reason: 'unverified_email', ...this.meta(ctx) },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new ForbiddenException('email_not_verified');
    }

    await this.rateLimit.reset(`failed_login:${normalisedEmail}`);
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    if (!user.mfaEnabledAt) {
      const { token } = this.tokens.signMfaToken({ userId: user.id, type: 'mfa_setup' });
      await this.audit.record({
        action: 'mfa.setup.initiated',
        userId: user.id,
        metadata: this.meta(ctx),
        ipAddress: ctx.ip,
      });
      return { step: 'mfa_setup_required', mfaSetupToken: token };
    }

    const { token } = this.tokens.signMfaToken({ userId: user.id, type: 'mfa_challenge' });
    return { step: 'mfa_challenge', mfaChallengeToken: token };
  }

  // ---------- MFA setup ----------

  async mfaSetupInit(
    mfaSetupToken: string,
  ): Promise<{ secret: string; qrCodeDataUrl: string; issuer: string; label: string }> {
    const payload = this.tryVerify(
      () => this.tokens.verifyMfaToken(mfaSetupToken, 'mfa_setup'),
      'invalid_setup_token',
    );
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt) throw new UnauthorizedException('user_not_found');

    const secret = this.mfa.generateSecret();
    const mfaCfg = this.config.get('mfa', { infer: true });
    await this.redis.client.setex(`mfa_setup:${user.id}`, mfaCfg.setupTokenTtlSeconds, secret);

    const otpauth = this.mfa.buildOtpAuthUrl(user.email, secret);
    const qrCodeDataUrl = await this.mfa.generateQrCodeDataUrl(otpauth);
    return { secret, qrCodeDataUrl, issuer: mfaCfg.issuer, label: user.email };
  }

  async mfaSetupComplete(
    input: { mfaSetupToken: string; totpCode: string },
    ctx: RequestContext,
  ): Promise<{
    backupCodes: string[];
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
  }> {
    const payload = this.tryVerify(
      () => this.tokens.verifyMfaToken(input.mfaSetupToken, 'mfa_setup'),
      'invalid_setup_token',
    );
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt) throw new UnauthorizedException('user_not_found');

    const secret = await this.redis.client.get(`mfa_setup:${user.id}`);
    if (!secret) throw new BadRequestException('mfa_setup_expired');

    if (!this.mfa.verifyTotp(input.totpCode, secret)) {
      throw new BadRequestException('invalid_totp_code');
    }

    const encryptedSecret = this.crypto.encrypt(secret, user.id);
    const { plaintext, hashes } = await this.mfa.generateBackupCodes();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: encryptedSecret, mfaEnabledAt: new Date(), mfaBackupCodes: hashes },
    });
    await this.redis.client.del(`mfa_setup:${user.id}`);

    await this.audit.record({
      action: 'mfa.setup.completed',
      userId: user.id,
      metadata: this.meta(ctx),
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const { accessToken, refreshToken, expiresIn } = await this.issueSession(user, ctx);
    return { backupCodes: plaintext, accessToken, refreshToken, expiresIn };
  }

  // ---------- MFA verify ----------

  async mfaVerify(
    input: { mfaChallengeToken: string; code: string },
    ctx: RequestContext,
  ): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
    const payload = this.tryVerify(
      () => this.tokens.verifyMfaToken(input.mfaChallengeToken, 'mfa_challenge'),
      'invalid_challenge_token',
    );

    const key = `failed_mfa:${payload.sub}`;
    const rl = await this.rateLimit.register(key, LOCKOUT_WINDOW_SECONDS, LOCKOUT_MAX_ATTEMPTS);
    if (rl.limited) throw new ForbiddenException('too_many_attempts');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.mfaSecret || !user.mfaEnabledAt)
      throw new UnauthorizedException('mfa_not_configured');

    const secret = this.crypto.decrypt(user.mfaSecret, user.id);
    const normalised = input.code.trim();

    let success = false;
    let viaBackupCode = false;

    if (/^\d{6}$/.test(normalised)) {
      success = this.mfa.verifyTotp(normalised, secret);
    }
    if (!success) {
      const idx = await this.mfa.verifyBackupCode(normalised, user.mfaBackupCodes);
      if (idx >= 0) {
        success = true;
        viaBackupCode = true;
        const remaining = [...user.mfaBackupCodes];
        remaining.splice(idx, 1);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { mfaBackupCodes: remaining },
        });
      }
    }

    if (!success) {
      await this.audit.record({
        action: 'mfa.verify.failed',
        userId: user.id,
        metadata: this.meta(ctx),
        ipAddress: ctx.ip,
      });
      throw new UnauthorizedException('invalid_mfa_code');
    }

    await this.rateLimit.reset(key);
    await this.audit.record({
      action: viaBackupCode ? 'mfa.backup_code.used' : 'mfa.verify.success',
      userId: user.id,
      metadata: this.meta(ctx),
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return this.issueSession(user, ctx);
  }

  // ---------- Refresh ----------

  async refresh(
    presentedRefresh: string,
    ctx: RequestContext,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const { session, refreshToken } = await this.sessions.rotate(presentedRefresh);
      const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) throw new UnauthorizedException('user_not_found');

      const { token: accessToken, expiresIn } = this.tokens.signAccessToken({
        userId: user.id,
        sessionId: session.id,
        email: user.email,
      });
      await this.sessions.touch(session.id);
      return { accessToken, refreshToken, expiresIn };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'refresh_failed';
      if (message === 'refresh_token_replay') {
        await this.audit.record({
          action: 'session.revoked',
          metadata: { reason: 'theft_detected', ...this.meta(ctx) },
          ipAddress: ctx.ip,
        });
      }
      throw new UnauthorizedException(message);
    }
  }

  // ---------- Logout ----------

  async logout(
    sessionId: string,
    jti: string,
    ttlSeconds: number,
    ctx: RequestContext,
  ): Promise<void> {
    await this.sessions.revoke(sessionId, 'user_logout');
    await this.redis.client.setex(`access_blacklist:${jti}`, ttlSeconds, '1');
    await this.audit.record({
      action: 'session.revoked',
      metadata: { reason: 'user_logout', ...this.meta(ctx) },
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  async logoutAll(userId: string, ctx: RequestContext): Promise<{ revokedCount: number }> {
    const count = await this.sessions.revokeAllForUser(userId, 'user_logout');
    await this.audit.record({
      action: 'session.revoked',
      userId,
      metadata: { reason: 'user_logout_all', meta: { count }, ...this.meta(ctx) },
      ipAddress: ctx.ip,
    });
    return { revokedCount: count };
  }

  // ---------- Email verify ----------

  async verifyEmail(token: string, ctx: RequestContext): Promise<{ ok: true }> {
    const hash = this.tokens.hashOpaqueToken(token);
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: hash, emailVerifyExpiresAt: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('invalid_or_expired_token');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), emailVerifyToken: null, emailVerifyExpiresAt: null },
    });
    await this.audit.record({
      action: 'auth.email.verified',
      userId: user.id,
      metadata: this.meta(ctx),
      ipAddress: ctx.ip,
    });
    return { ok: true };
  }

  async resendVerification(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.emailVerifiedAt) return { ok: true };

    const token = this.tokens.generateOpaqueToken();
    const hash = this.tokens.hashOpaqueToken(token);
    const ttl = this.config.get('auth', { infer: true }).emailVerifyTtlSeconds;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: hash, emailVerifyExpiresAt: new Date(Date.now() + ttl * 1000) },
    });
    await this.email.enqueueVerifyEmail({
      to: user.email,
      fullName: user.fullName,
      token,
      locale: 'tr',
    });
    return { ok: true };
  }

  // ---------- Password flows ----------

  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deletedAt) return { ok: true }; // enumeration-safe

    const token = this.tokens.generateOpaqueToken();
    const hash = this.tokens.hashOpaqueToken(token);
    const ttl = this.config.get('auth', { infer: true }).passwordResetTtlSeconds;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hash, passwordResetExpiresAt: new Date(Date.now() + ttl * 1000) },
    });
    await this.email.enqueuePasswordReset({
      to: user.email,
      fullName: user.fullName,
      token,
      locale: 'tr',
    });
    return { ok: true };
  }

  async resetPassword(
    input: { token: string; newPassword: string },
    ctx: RequestContext,
  ): Promise<{ ok: true }> {
    const hash = this.tokens.hashOpaqueToken(input.token);
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: hash, passwordResetExpiresAt: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('invalid_or_expired_token');

    const strength = await this.passwords.validateStrength({
      password: input.newPassword,
      email: user.email,
      fullName: user.fullName,
    });
    if (!strength.ok)
      throw new BadRequestException({
        message: strength.feedback ?? 'weak_password',
        code: 'weak_password',
      });

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.sessions.revokeAllForUser(user.id, 'password_reset');
    await this.audit.record({
      action: 'password.reset',
      userId: user.id,
      metadata: this.meta(ctx),
      ipAddress: ctx.ip,
    });
    return { ok: true };
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    input: { currentPassword: string; newPassword: string },
    ctx: RequestContext,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('user_not_found');
    const ok = await this.passwords.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('wrong_password');

    const strength = await this.passwords.validateStrength({
      password: input.newPassword,
      email: user.email,
      fullName: user.fullName,
    });
    if (!strength.ok)
      throw new BadRequestException({
        message: strength.feedback ?? 'weak_password',
        code: 'weak_password',
      });

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.sessions.revokeAllForUser(user.id, 'password_change', currentSessionId);
    await this.audit.record({
      action: 'password.changed',
      userId: user.id,
      metadata: this.meta(ctx),
      ipAddress: ctx.ip,
    });
    return { ok: true };
  }

  // ---------- Helpers ----------

  private async issueSession(
    user: { id: string; email: string },
    ctx: RequestContext,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const { session, refreshToken } = await this.sessions.create({
      userId: user.id,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ip,
    });
    const { token, expiresIn } = this.tokens.signAccessToken({
      userId: user.id,
      sessionId: session.id,
      email: user.email,
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip ?? null },
    });
    await this.audit.record({
      action: 'login.success',
      userId: user.id,
      metadata: this.meta(ctx),
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { accessToken: token, refreshToken, expiresIn };
  }

  private async recordFailedLogin(
    email: string,
    reason: 'wrong_password' | 'user_not_found',
    userId: string | null,
    ctx: RequestContext,
  ): Promise<void> {
    const key = `failed_login:${email}`;
    const rl = await this.rateLimit.register(key, LOCKOUT_WINDOW_SECONDS, LOCKOUT_MAX_ATTEMPTS);
    if (userId) {
      const data: Prisma.UserUpdateInput = { failedLoginAttempts: { increment: 1 } };
      if (rl.limited) {
        data.lockedUntil = new Date(Date.now() + LOCKOUT_WINDOW_SECONDS * 1000);
      }
      await this.prisma.user.update({ where: { id: userId }, data });
    }
    await this.audit.record({
      action: 'login.failed',
      userId,
      metadata: { reason, ...this.meta(ctx) },
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  private meta(ctx: RequestContext): AuditMetadata {
    return { ip: ctx.ip, userAgent: ctx.userAgent };
  }

  private tryVerify<T>(fn: () => T, errorCode: string): T {
    try {
      return fn();
    } catch {
      throw new UnauthorizedException(errorCode);
    }
  }

  private slugifyFullName(name: string): string {
    return (
      name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'org'
    );
  }

  private async uniqueSlug(
    tx: Prisma.TransactionClient,
    base: string,
    kind: 'organization' | 'workspace',
    orgId?: string,
  ): Promise<string> {
    let candidate = base;
    for (let i = 1; i < 50; i += 1) {
      const exists =
        kind === 'organization'
          ? await tx.organization.findUnique({ where: { slug: candidate } })
          : orgId
            ? await tx.workspace.findFirst({
                where: { organizationId: orgId, slug: candidate },
              })
            : null;
      if (!exists) return candidate;
      candidate = `${base}-${(Math.floor(Math.random() * 9000) + 1000).toString()}`;
    }
    throw new Error('could not generate unique slug');
  }

  private async acceptInvitationInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    plaintextToken: string,
  ): Promise<void> {
    const hash = this.tokens.hashOpaqueToken(plaintextToken);
    const inv = await tx.invitation.findFirst({
      where: { tokenHash: hash, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
    });
    if (!inv) throw new BadRequestException('invalid_or_expired_invitation');

    const orgRole = inv.role === 'ORG_ADMIN' ? OrgRole.ADMIN : OrgRole.MEMBER;
    await tx.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: inv.organizationId, userId } },
      create: { organizationId: inv.organizationId, userId, role: orgRole },
      update: { role: orgRole },
    });

    if (inv.workspaceId && inv.role.startsWith('WS_')) {
      const wsRole =
        inv.role === 'WS_ADMIN'
          ? WorkspaceRole.ADMIN
          : inv.role === 'WS_MANAGER'
            ? WorkspaceRole.MANAGER
            : WorkspaceRole.VIEWER;
      await tx.workspaceMembership.upsert({
        where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } },
        create: { workspaceId: inv.workspaceId, userId, role: wsRole },
        update: { role: wsRole },
      });
    }

    await tx.invitation.update({
      where: { id: inv.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    });
  }

  notFoundIfNull<T>(value: T | null, message: string): T {
    if (!value) throw new NotFoundException(message);
    return value;
  }
}
