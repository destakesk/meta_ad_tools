import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { AuthService } from '../auth/auth.service.js';
import { CustomHeaderGuard } from '../auth/guards/custom-header.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { OrganizationsService } from '../organizations/organizations.service.js';

class AcceptUserDataDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsString() @MinLength(2) @MaxLength(100) fullName!: string;
}

class AcceptDto {
  @IsString() token!: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AcceptUserDataDto)
  userData?: AcceptUserDataDto;
}

@Controller('invitations')
@UseGuards(JwtAuthGuard, CustomHeaderGuard)
export class InvitationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly auth: AuthService,
  ) {}

  @Get('preview')
  @Public()
  async preview(@Query('token') token: string) {
    return this.orgs.previewInvitation(token);
  }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  async accept(@Body() dto: AcceptDto) {
    if (dto.userData) {
      const result = await this.auth.register(
        {
          email: dto.userData.email,
          password: dto.userData.password,
          fullName: dto.userData.fullName,
          invitationToken: dto.token,
        },
        { ip: undefined, userAgent: undefined },
      );
      return { ok: true, requiresLogin: true, userId: result.userId };
    }
    // Existing authenticated users hit a different flow — handled in the auth
    // controller via an authenticated call. For now we treat missing userData
    // as user-must-log-in-then-accept.
    return { ok: true, requiresLogin: true };
  }
}
