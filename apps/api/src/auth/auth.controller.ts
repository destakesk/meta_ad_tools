import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { extractIp } from '../common/throttling/ip.js';
import { AuthService } from './auth.service.js';
import { CustomHeaderGuard } from './guards/custom-header.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser, type RequestUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import {
  ChangePasswordDto,
  EmailVerifyDto,
  ForgotPasswordDto,
  LoginDto,
  MfaSetupDto,
  MfaSetupInitQueryDto,
  MfaVerifyDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
} from './dto/index.js';
import { SessionService } from './services/session.service.js';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearRefreshCookie,
  setRefreshCookie,
} from '../common/helpers/cookies.js';

import type { AppConfig } from '../config/configuration.js';

@Controller('auth')
@UseGuards(JwtAuthGuard, CustomHeaderGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ---------- Register ----------
  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, { ip: extractIp(req), userAgent: req.headers['user-agent'] });
  }

  // ---------- Login ----------
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, { ip: extractIp(req), userAgent: req.headers['user-agent'] });
  }

  // ---------- MFA ----------
  @Get('mfa/setup/init')
  @Public()
  async mfaSetupInit(@Query() query: MfaSetupInitQueryDto) {
    return this.auth.mfaSetupInit(query.mfaSetupToken);
  }

  @Post('mfa/setup')
  @Public()
  @HttpCode(HttpStatus.OK)
  async mfaSetup(
    @Body() dto: MfaSetupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.mfaSetupComplete(dto, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
    this.writeRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      backupCodes: result.backupCodes,
    };
  }

  @Post('mfa/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  async mfaVerify(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.mfaVerify(dto, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
    this.writeRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  // ---------- Refresh ----------
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[REFRESH_COOKIE];
    if (!token) return { accessToken: null };
    const result = await this.auth.refresh(token, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
    this.writeRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  // ---------- Logout ----------
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ttl = this.config.get('auth', { infer: true }).accessTokenTtlSeconds;
    await this.auth.logout(user.sessionId, user.jti, ttl, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
    clearRefreshCookie(res, this.config.get('cookies', { infer: true }));
    res.clearCookie(ACCESS_COOKIE);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.logoutAll(user.userId, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
    clearRefreshCookie(res, this.config.get('cookies', { infer: true }));
    return result;
  }

  // ---------- Email ----------
  @Post('email/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: EmailVerifyDto, @Req() req: Request) {
    return this.auth.verifyEmail(dto.token, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('email/resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  // ---------- Password ----------
  @Post('password/forgot')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('password/reset')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(user.userId, user.sessionId, dto, {
      ip: extractIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  // ---------- Sessions ----------
  @Get('sessions')
  async listSessions(@CurrentUser() user: RequestUser) {
    const rows = await this.sessions.listForUser(user.userId);
    return {
      sessions: rows.map((s) => ({
        id: s.id,
        device: s.device,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastUsedAt: s.lastUsedAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        isCurrent: s.id === user.sessionId,
      })),
    };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async revokeSession(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    if (id === user.sessionId) {
      return {
        ok: false,
        error: {
          code: 'cannot_revoke_current',
          message: 'Mevcut oturum bu endpoint ile silinemez',
        },
      };
    }
    await this.sessions.revoke(id, 'admin_revoke');
    return { ok: true };
  }

  private writeRefreshCookie(res: Response, token: string): void {
    const cfg = {
      domain: this.config.get('cookies', { infer: true }).domain,
      secure: this.config.get('cookies', { infer: true }).secure,
    };
    const ttl = this.config.get('auth', { infer: true }).refreshTokenTtlSeconds;
    setRefreshCookie(res, token, cfg, ttl);
  }
}
