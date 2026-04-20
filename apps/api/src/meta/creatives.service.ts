import { CreativeKind, MetaConnectionStatus } from '@metaflow/database';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../auth/services/audit.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { META_API_CLIENT } from './meta-api-client.interface.js';

import type {
  MetaApiClient,
  MetaCreativeKind,
  MetaCreativeSnapshot,
} from './meta-api-client.interface.js';
import type { Creative } from '@metaflow/database';

export interface CreateCreativeInput {
  adAccountId: string;
  name: string;
  kind: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'LINK' | 'POST';
  thumbUrl?: string;
  objectStorySpec?: Record<string, unknown>;
}

export interface PublicCreative {
  id: string;
  workspaceId: string;
  adAccountId: string;
  metaCreativeId: string;
  name: string;
  kind: CreativeKind;
  thumbUrl: string | null;
  objectStorySpec: unknown;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CreativesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(META_API_CLIENT) private readonly meta: MetaApiClient,
  ) {}

  async syncForAdAccount(
    workspaceId: string,
    userId: string,
    adAccountId: string,
  ): Promise<{ syncedCount: number }> {
    const { accessToken, account } = await this.loadAdAccount(workspaceId, adAccountId);

    const remote = await this.meta.fetchCreatives({
      accessToken,
      metaAdAccountId: account.metaAdAccountId,
    });

    for (const snapshot of remote) {
      await this.prisma.creative.upsert({
        where: {
          adAccountId_metaCreativeId: {
            adAccountId: account.id,
            metaCreativeId: snapshot.metaCreativeId,
          },
        },
        create: this.toCreate(workspaceId, account.id, snapshot),
        update: this.toUpdate(snapshot),
      });
    }

    await this.audit.record({
      action: 'creative.synced',
      userId,
      targetType: 'adaccount',
      targetId: account.id,
      metadata: { meta: { count: remote.length } },
    });

    return { syncedCount: remote.length };
  }

  async listForWorkspace(workspaceId: string): Promise<PublicCreative[]> {
    const rows = await this.prisma.creative.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((r) => this.toPublic(r));
  }

  async listForAdAccount(workspaceId: string, adAccountId: string): Promise<PublicCreative[]> {
    const account = await this.prisma.metaAdAccount.findFirst({
      where: { id: adAccountId, connection: { workspaceId } },
    });
    if (!account) throw new NotFoundException('adaccount_not_found');

    const rows = await this.prisma.creative.findMany({
      where: { adAccountId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((r) => this.toPublic(r));
  }

  async getById(workspaceId: string, id: string): Promise<PublicCreative> {
    const row = await this.prisma.creative.findFirst({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('creative_not_found');
    return this.toPublic(row);
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateCreativeInput,
  ): Promise<PublicCreative> {
    const { accessToken, account } = await this.loadAdAccount(workspaceId, input.adAccountId);

    const snapshot = await this.meta.createCreative({
      accessToken,
      metaAdAccountId: account.metaAdAccountId,
      name: input.name,
      kind: input.kind,
      ...(input.thumbUrl !== undefined ? { thumbUrl: input.thumbUrl } : {}),
      ...(input.objectStorySpec !== undefined ? { objectStorySpec: input.objectStorySpec } : {}),
    });

    const row = await this.prisma.creative.create({
      data: this.toCreate(workspaceId, account.id, snapshot),
    });

    await this.audit.record({
      action: 'creative.created',
      userId,
      targetType: 'creative',
      targetId: row.id,
    });

    return this.toPublic(row);
  }

  async delete(workspaceId: string, userId: string, id: string): Promise<void> {
    const existing = await this.prisma.creative.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('creative_not_found');

    // Refuse to delete if an ACTIVE ad still points at this creative —
    // otherwise the ad would silently lose its creative reference. PAUSED
    // / DELETED ads are fine; the SetNull FK handles those.
    const livingAd = await this.prisma.ad.findFirst({
      where: { creativeId: existing.id, status: { notIn: ['DELETED', 'ARCHIVED'] } },
    });
    if (livingAd !== null) {
      throw new BadRequestException('creative_in_use');
    }

    const { accessToken } = await this.loadAdAccount(workspaceId, existing.adAccountId);
    await this.meta.deleteCreative({
      accessToken,
      metaCreativeId: existing.metaCreativeId,
    });

    await this.prisma.creative.delete({ where: { id } });

    await this.audit.record({
      action: 'creative.deleted',
      userId,
      targetType: 'creative',
      targetId: id,
    });
  }

  /**
   * Shared: verifies (workspace, ad account) + decrypts the Meta token.
   * All creative write endpoints route through this.
   */
  private async loadAdAccount(
    workspaceId: string,
    adAccountId: string,
  ): Promise<{
    accessToken: string;
    account: { id: string; metaAdAccountId: string };
  }> {
    const account = await this.prisma.metaAdAccount.findFirst({
      where: { id: adAccountId, connection: { workspaceId } },
    });
    if (!account) throw new NotFoundException('adaccount_not_found');

    const connection = await this.prisma.metaConnection.findFirst({
      where: { workspaceId, status: MetaConnectionStatus.ACTIVE },
    });
    if (!connection) throw new NotFoundException('meta_connection_not_found');

    const accessToken = this.crypto.decrypt(
      connection.accessToken,
      `meta_connection:${workspaceId}`,
    );
    return {
      accessToken,
      account: { id: account.id, metaAdAccountId: account.metaAdAccountId },
    };
  }

  private toCreate(workspaceId: string, adAccountId: string, s: MetaCreativeSnapshot) {
    return {
      workspaceId,
      adAccountId,
      metaCreativeId: s.metaCreativeId,
      name: s.name,
      kind: this.mapKind(s.kind),
      thumbUrl: s.thumbUrl,
      objectStorySpec: (s.objectStorySpec ?? null) as never,
      syncedAt: new Date(),
    };
  }

  private toUpdate(s: MetaCreativeSnapshot) {
    return {
      name: s.name,
      kind: this.mapKind(s.kind),
      thumbUrl: s.thumbUrl,
      objectStorySpec: (s.objectStorySpec ?? null) as never,
      syncedAt: new Date(),
    };
  }

  private mapKind(k: MetaCreativeKind): CreativeKind {
    switch (k) {
      case 'IMAGE':
        return CreativeKind.IMAGE;
      case 'VIDEO':
        return CreativeKind.VIDEO;
      case 'CAROUSEL':
        return CreativeKind.CAROUSEL;
      case 'LINK':
        return CreativeKind.LINK;
      case 'POST':
        return CreativeKind.POST;
    }
  }

  private toPublic(row: Creative): PublicCreative {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      adAccountId: row.adAccountId,
      metaCreativeId: row.metaCreativeId,
      name: row.name,
      kind: row.kind,
      thumbUrl: row.thumbUrl,
      objectStorySpec: row.objectStorySpec,
      syncedAt: row.syncedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
