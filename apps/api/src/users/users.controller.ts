import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  IsNotEmpty,
  Matches,
} from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { MfaService } from '../auth/services/mfa.service.js';
import { PasswordService } from '../auth/services/password.service.js';
import { PermissionResolver } from '../permissions/permission-resolver.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../auth/services/audit.service.js';

import type { AppConfig } from '../config/configuration.js';

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) fullName?: string;
  @IsOptional() @IsUrl() @MaxLength(2048) avatarUrl?: string;
}

class RegenerateBackupCodesDto {
  @IsString() @IsNotEmpty() password!: string;
}

class DisableMfaDto {
  @IsString() @IsNotEmpty() password!: string;
  @IsString() @Matches(/^\d{6}$/) totpCode!: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, CustomHeaderGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mfa: MfaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly resolver: PermissionResolver,
  ) {}

  /**
   * Returns the effective permission set for the current user. Drives
   * frontend `useCan()` UI visibility. When `workspaceSlug` is supplied,
   * both org-scoped and workspace-scoped permissions are merged.
   *
   * The API itself does NOT trust this endpoint — every mutating route still
   * goes through PermissionGuard. This is purely a UI hint.
   */
  @Get('me/permissions')
  async permissions(
    @CurrentUser() user: RequestUser,
    @Query('workspaceSlug') workspaceSlug?: string,
  ) {
    const orgMembership = await this.prisma.organizationMembership.findFirst({
      where: { userId: user.userId },
      orderBy: { createdAt: 'asc' },
    });
    const orgId = orgMembership?.organizationId;

    let workspaceId: string | undefined;
    if (workspaceSlug) {
      const ws = await this.prisma.workspace.findFirst({
        where: { slug: workspaceSlug, deletedAt: null, organizationId: orgId },
      });
      if (ws) workspaceId = ws.id;
    }

    const perms = await this.resolver.effectivePermissions(user.userId, {
      organizationId: orgId,
      workspaceId,
    });
    return { permissions: [...perms] };
  }

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      include: {
        orgMemberships: { include: { organization: true } },
      },
    });
    return {
      user: {
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        avatarUrl: row.avatarUrl,
        emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
        mfaEnabled: !!row.mfaEnabledAt,
        createdAt: row.createdAt.toISOString(),
      },
      mfaEnabled: !!row.mfaEnabledAt,
      organizations: row.orgMemberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      })),
    };
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    const data: { fullName?: string; avatarUrl?: string | null } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    const updated = await this.prisma.user.update({ where: { id: user.userId }, data });
    return { id: updated.id, fullName: updated.fullName, avatarUrl: updated.avatarUrl };
  }

  @Post('me/mfa/regenerate-backup-codes')
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegenerateBackupCodesDto,
  ) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    if (!(await this.passwords.compare(dto.password, row.passwordHash))) {
      throw new ForbiddenException('wrong_password');
    }
    const { plaintext, hashes } = await this.mfa.generateBackupCodes();
    await this.prisma.user.update({ where: { id: user.userId }, data: { mfaBackupCodes: hashes } });
    return { backupCodes: plaintext };
  }

  @Post('me/mfa/disable')
  @HttpCode(HttpStatus.OK)
  async disableMfa(@CurrentUser() user: RequestUser, @Body() dto: DisableMfaDto) {
    if (!this.config.get('mfa', { infer: true }).disableAllowed) {
      throw new ForbiddenException('mfa_disable_not_allowed');
    }
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    if (!(await this.passwords.compare(dto.password, row.passwordHash))) {
      throw new ForbiddenException('wrong_password');
    }
    if (!row.mfaSecret || !row.mfaEnabledAt) throw new BadRequestException('mfa_not_enabled');
    const secret = this.crypto.decrypt(row.mfaSecret, user.userId);
    if (!this.mfa.verifyTotp(dto.totpCode, secret))
      throw new BadRequestException('invalid_totp_code');

    await this.prisma.user.update({
      where: { id: user.userId },
      data: { mfaSecret: null, mfaEnabledAt: null, mfaBackupCodes: [] },
    });
    await this.audit.record({ action: 'mfa.disabled', userId: user.userId });
    return { ok: true };
  }
}
