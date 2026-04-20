import { AdStatus, MetaConnectionStatus } from '@metaflow/database';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../auth/services/audit.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { META_API_CLIENT } from './meta-api-client.interface.js';

import type { MetaAdSnapshot, MetaAdStatus, MetaApiClient } from './meta-api-client.interface.js';
import type { Ad } from '@metaflow/database';

export interface CreateAdInput {
  adsetId: string;
  creativeId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED';
}

export interface UpdateAdInput {
  name?: string;
  status?: 'ACTIVE' | 'PAUSED';
  creativeId?: string;
}

export interface PublicAd {
  id: string;
  workspaceId: string;
  campaignId: string;
  adsetId: string;
  creativeId: string | null;
  metaAdId: string;
  name: string;
  status: AdStatus;
  effectiveStatus: string | null;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(META_API_CLIENT) private readonly meta: MetaApiClient,
  ) {}

  async syncForAdSet(
    workspaceId: string,
    userId: string,
    adsetId: string,
  ): Promise<{ syncedCount: number }> {
    const { accessToken, adset } = await this.loadAdSet(workspaceId, adsetId);

    const remote = await this.meta.fetchAds({
      accessToken,
      metaAdSetId: adset.metaAdSetId,
    });

    for (const snapshot of remote) {
      const creativeId = await this.resolveCreativeId(workspaceId, snapshot.metaCreativeId);
      await this.prisma.ad.upsert({
        where: {
          adsetId_metaAdId: { adsetId: adset.id, metaAdId: snapshot.metaAdId },
        },
        create: this.toCreate(workspaceId, adset.campaignId, adset.id, creativeId, snapshot),
        update: this.toUpdate(creativeId, snapshot),
      });
    }

    await this.prisma.ad.updateMany({
      where: {
        adsetId: adset.id,
        metaAdId: { notIn: remote.map((r) => r.metaAdId) },
        status: { not: AdStatus.DELETED },
      },
      data: { status: AdStatus.DELETED, syncedAt: new Date() },
    });

    await this.audit.record({
      action: 'ad.synced',
      userId,
      targetType: 'adset',
      targetId: adset.id,
      metadata: { meta: { count: remote.length } },
    });

    return { syncedCount: remote.length };
  }

  async listForAdSet(workspaceId: string, adsetId: string): Promise<PublicAd[]> {
    const adset = await this.prisma.adSet.findFirst({ where: { id: adsetId, workspaceId } });
    if (!adset) throw new NotFoundException('adset_not_found');

    const rows = await this.prisma.ad.findMany({
      where: { adsetId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toPublic(r));
  }

  async getById(workspaceId: string, id: string): Promise<PublicAd> {
    const row = await this.prisma.ad.findFirst({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('ad_not_found');
    return this.toPublic(row);
  }

  async create(workspaceId: string, userId: string, input: CreateAdInput): Promise<PublicAd> {
    const { accessToken, adset } = await this.loadAdSet(workspaceId, input.adsetId);

    const creative = await this.prisma.creative.findFirst({
      where: { id: input.creativeId, workspaceId },
    });
    if (!creative) throw new NotFoundException('creative_not_found');

    const snapshot = await this.meta.createAd({
      accessToken,
      metaAdSetId: adset.metaAdSetId,
      name: input.name,
      status: input.status,
      metaCreativeId: creative.metaCreativeId,
    });

    const row = await this.prisma.ad.create({
      data: this.toCreate(workspaceId, adset.campaignId, adset.id, creative.id, snapshot),
    });

    await this.audit.record({
      action: 'ad.created',
      userId,
      targetType: 'ad',
      targetId: row.id,
    });

    return this.toPublic(row);
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateAdInput,
  ): Promise<PublicAd> {
    const existing = await this.prisma.ad.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('ad_not_found');
    if (existing.status === AdStatus.DELETED) throw new BadRequestException('ad_deleted');

    const { accessToken } = await this.loadAdSet(workspaceId, existing.adsetId);

    let creative: { id: string; metaCreativeId: string } | null = null;
    if (input.creativeId !== undefined) {
      const found = await this.prisma.creative.findFirst({
        where: { id: input.creativeId, workspaceId },
      });
      if (!found) throw new NotFoundException('creative_not_found');
      creative = { id: found.id, metaCreativeId: found.metaCreativeId };
    }

    const snapshot = await this.meta.updateAd({
      accessToken,
      metaAdId: existing.metaAdId,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(creative !== null ? { metaCreativeId: creative.metaCreativeId } : {}),
    });

    const nextCreativeId = creative !== null ? creative.id : existing.creativeId;
    const row = await this.prisma.ad.update({
      where: { id },
      data: this.toUpdate(nextCreativeId, snapshot),
    });

    await this.audit.record({
      action: 'ad.updated',
      userId,
      targetType: 'ad',
      targetId: row.id,
    });

    return this.toPublic(row);
  }

  async delete(workspaceId: string, userId: string, id: string): Promise<void> {
    const existing = await this.prisma.ad.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('ad_not_found');
    if (existing.status === AdStatus.DELETED) return;

    const { accessToken } = await this.loadAdSet(workspaceId, existing.adsetId);

    await this.meta.deleteAd({ accessToken, metaAdId: existing.metaAdId });

    await this.prisma.ad.update({
      where: { id },
      data: { status: AdStatus.DELETED, syncedAt: new Date() },
    });

    await this.audit.record({
      action: 'ad.deleted',
      userId,
      targetType: 'ad',
      targetId: id,
    });
  }

  /**
   * Shared: verifies (workspace, adset) + decrypts the Meta token. Uses a
   * chained lookup through the campaign so sync/write endpoints can find
   * both the meta id and the parent campaign in one hop.
   */
  private async loadAdSet(
    workspaceId: string,
    adsetId: string,
  ): Promise<{
    accessToken: string;
    adset: { id: string; metaAdSetId: string; campaignId: string };
  }> {
    const adset = await this.prisma.adSet.findFirst({
      where: { id: adsetId, workspaceId },
    });
    if (!adset) throw new NotFoundException('adset_not_found');

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
      adset: {
        id: adset.id,
        metaAdSetId: adset.metaAdSetId,
        campaignId: adset.campaignId,
      },
    };
  }

  /**
   * Best-effort: if the Meta snapshot references a creative we already
   * synced into our own creative library, resolve it to our local id so
   * the FK is populated. If not, leave null — the creative can be synced
   * later and the ad row back-linked on re-sync.
   */
  private async resolveCreativeId(
    workspaceId: string,
    metaCreativeId: string | null,
  ): Promise<string | null> {
    if (metaCreativeId === null) return null;
    const found = await this.prisma.creative.findFirst({
      where: { workspaceId, metaCreativeId },
      select: { id: true },
    });
    return found?.id ?? null;
  }

  private toCreate(
    workspaceId: string,
    campaignId: string,
    adsetId: string,
    creativeId: string | null,
    s: MetaAdSnapshot,
  ) {
    return {
      workspaceId,
      campaignId,
      adsetId,
      creativeId,
      metaAdId: s.metaAdId,
      name: s.name,
      status: this.mapStatus(s.status),
      effectiveStatus: s.effectiveStatus,
      syncedAt: new Date(),
    };
  }

  private toUpdate(creativeId: string | null, s: MetaAdSnapshot) {
    return {
      name: s.name,
      status: this.mapStatus(s.status),
      effectiveStatus: s.effectiveStatus,
      creativeId,
      syncedAt: new Date(),
    };
  }

  private mapStatus(s: MetaAdStatus): AdStatus {
    switch (s) {
      case 'ACTIVE':
        return AdStatus.ACTIVE;
      case 'PAUSED':
        return AdStatus.PAUSED;
      case 'DELETED':
        return AdStatus.DELETED;
      case 'ARCHIVED':
        return AdStatus.ARCHIVED;
      default:
        return AdStatus.UNKNOWN;
    }
  }

  private toPublic(row: Ad): PublicAd {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      campaignId: row.campaignId,
      adsetId: row.adsetId,
      creativeId: row.creativeId,
      metaAdId: row.metaAdId,
      name: row.name,
      status: row.status,
      effectiveStatus: row.effectiveStatus,
      syncedAt: row.syncedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
