import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationStatus, OrgRole, WorkspaceRole } from '@metaflow/database';
import { RESERVED_SLUGS } from '@metaflow/shared-types';

import { AuditService } from '../auth/services/audit.service.js';
import { EmailService } from '../email/email.service.js';
import { TokenService } from '../auth/services/token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionResolver } from '../permissions/permission-resolver.service.js';

import type { AppConfig } from '../config/configuration.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly resolver: PermissionResolver,
  ) {}

  async currentForUser(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      include: { organization: { include: { workspaces: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const first = memberships[0];
    if (!first) throw new NotFoundException('no_organization');
    return {
      organization: {
        id: first.organization.id,
        name: first.organization.name,
        slug: first.organization.slug,
        createdAt: first.organization.createdAt.toISOString(),
        updatedAt: first.organization.updatedAt.toISOString(),
      },
      userRole: first.role,
      workspaces: first.organization.workspaces.map((w) => ({
        id: w.id,
        organizationId: w.organizationId,
        name: w.name,
        slug: w.slug,
        archivedAt: w.archivedAt?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    };
  }

  async invite(
    inviterId: string,
    organizationId: string,
    input: { email: string; role: string; workspaceId?: string },
  ) {
    const target = input.email.toLowerCase();
    const token = this.tokens.generateOpaqueToken();
    const tokenHash = this.tokens.hashOpaqueToken(token);
    const ttl = this.config.get('auth', { infer: true }).invitationTtlSeconds;

    const inviter = await this.prisma.user.findUniqueOrThrow({ where: { id: inviterId } });
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });

    const inv = await this.prisma.invitation.create({
      data: {
        organizationId,
        workspaceId: input.workspaceId ?? null,
        email: target,
        role: input.role,
        tokenHash,
        invitedById: inviterId,
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });

    await this.email.enqueueInvitation({
      to: target,
      inviterName: inviter.fullName,
      organizationName: org.name,
      role: input.role,
      token,
      locale: 'tr',
    });
    await this.audit.record({
      action: 'member.invited',
      userId: inviterId,
      targetType: 'invitation',
      targetId: inv.id,
      metadata: { meta: { email: target, role: input.role } },
    });
    await this.resolver.invalidate(inviterId);
    return { invitationId: inv.id, expiresAt: inv.expiresAt.toISOString() };
  }

  async createWorkspace(
    userId: string,
    organizationId: string,
    input: { name: string; slug: string },
  ) {
    if (RESERVED_SLUGS.includes(input.slug)) {
      throw new BadRequestException('reserved_slug');
    }
    const existing = await this.prisma.workspace.findFirst({
      where: { organizationId, slug: input.slug, deletedAt: null },
    });
    if (existing) throw new BadRequestException('slug_already_taken');

    const ws = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { organizationId, name: input.name, slug: input.slug },
      });
      await tx.workspaceMembership.create({
        data: { workspaceId: workspace.id, userId, role: WorkspaceRole.ADMIN },
      });
      return workspace;
    });

    await this.resolver.invalidate(userId);
    await this.audit.record({
      action: 'workspace.created',
      userId,
      targetType: 'workspace',
      targetId: ws.id,
    });
    return {
      id: ws.id,
      organizationId: ws.organizationId,
      name: ws.name,
      slug: ws.slug,
      archivedAt: ws.archivedAt?.toISOString() ?? null,
      createdAt: ws.createdAt.toISOString(),
      updatedAt: ws.updatedAt.toISOString(),
    };
  }

  /**
   * Guards against demoting or removing the sole ORG_OWNER. Controllers call
   * this before mutating memberships.
   */
  async assertNotLastOwner(organizationId: string, userIdBeingDemoted: string, newRole?: OrgRole) {
    if (newRole === OrgRole.OWNER) return;
    const owners = await this.prisma.organizationMembership.findMany({
      where: { organizationId, role: OrgRole.OWNER },
    });
    if (owners.length === 1 && owners[0]?.userId === userIdBeingDemoted) {
      throw new ForbiddenException('last_admin_demotion_blocked');
    }
  }

  async previewInvitation(token: string) {
    const hash = this.tokens.hashOpaqueToken(token);
    const inv = await this.prisma.invitation.findFirst({
      where: { tokenHash: hash, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
      include: { organization: true, invitedBy: true },
    });
    if (!inv) throw new NotFoundException('invitation_not_found_or_expired');
    return {
      email: inv.email,
      organizationName: inv.organization.name,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
      inviterName: inv.invitedBy.fullName,
    };
  }
}
