import { CampaignStatus, MetaConnectionStatus } from '@metaflow/database';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../auth/services/audit.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { META_API_CLIENT } from './meta-api-client.interface.js';

import type {
  MetaApiClient,
  MetaCampaignSnapshot,
  MetaCampaignStatus,
} from './meta-api-client.interface.js';
import type { Campaign } from '@metaflow/database';

export interface PublicCampaign {
  id: string;
  workspaceId: string;
  adAccountId: string;
  metaAdAccountId: string;
  metaCampaignId: string;
  name: string;
  objective: string | null;
  status: CampaignStatus;
  dailyBudgetCents: string | null;
  lifetimeBudgetCents: string | null;
  currency: string | null;
  startTime: string | null;
  endTime: string | null;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(META_API_CLIENT) private readonly meta: MetaApiClient,
  ) {}

  /**
   * Pulls every ad account's campaign list for the workspace's active Meta
   * connection and upserts the local `campaigns` table. Deleted-on-Meta
   * campaigns are left in the DB but flipped to DELETED so historical
   * insights stay attached.
   */
  async syncFromMeta(
    workspaceId: string,
    userId: string,
  ): Promise<{ syncedCount: number; adAccountIds: string[] }> {
    const connection = await this.prisma.metaConnection.findFirst({
      where: { workspaceId, status: MetaConnectionStatus.ACTIVE },
      include: { adAccounts: true },
    });
    if (!connection) throw new NotFoundException('meta_connection_not_found');

    const accessToken = this.crypto.decrypt(
      connection.accessToken,
      `meta_connection:${workspaceId}`,
    );

    let syncedCount = 0;
    for (const ad of connection.adAccounts) {
      const remote = await this.meta.fetchCampaigns({
        accessToken,
        metaAdAccountId: ad.metaAdAccountId,
      });

      for (const c of remote) {
        await this.prisma.campaign.upsert({
          where: {
            adAccountId_metaCampaignId: {
              adAccountId: ad.id,
              metaCampaignId: c.metaCampaignId,
            },
          },
          create: this.toCreate(workspaceId, ad.id, c),
          update: this.toUpdate(c),
        });
        syncedCount += 1;
      }

      // Mark locally-cached-but-missing-upstream rows DELETED so detail
      // pages don't keep treating them as active.
      const remoteIds = remote.map((r) => r.metaCampaignId);
      await this.prisma.campaign.updateMany({
        where: {
          adAccountId: ad.id,
          metaCampaignId: { notIn: remoteIds },
          status: { not: CampaignStatus.DELETED },
        },
        data: { status: CampaignStatus.DELETED, syncedAt: new Date() },
      });
    }

    await this.audit.record({
      action: 'campaign.synced',
      userId,
      targetType: 'meta_connection',
      targetId: connection.id,
      metadata: { meta: { workspaceId, count: syncedCount } },
    });

    return {
      syncedCount,
      adAccountIds: connection.adAccounts.map((a) => a.id),
    };
  }

  async listForWorkspace(workspaceId: string): Promise<PublicCampaign[]> {
    const rows = await this.prisma.campaign.findMany({
      where: { workspaceId },
      include: { adAccount: true },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toPublic(r, r.adAccount.metaAdAccountId));
  }

  async getById(workspaceId: string, id: string): Promise<PublicCampaign> {
    const row = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      include: { adAccount: true },
    });
    if (!row) throw new NotFoundException('campaign_not_found');
    return this.toPublic(row, row.adAccount.metaAdAccountId);
  }

  private toCreate(workspaceId: string, adAccountId: string, c: MetaCampaignSnapshot) {
    return {
      workspaceId,
      adAccountId,
      metaCampaignId: c.metaCampaignId,
      name: c.name,
      objective: c.objective,
      status: this.mapStatus(c.status),
      dailyBudgetCents: c.dailyBudgetCents !== null ? BigInt(c.dailyBudgetCents) : null,
      lifetimeBudgetCents: c.lifetimeBudgetCents !== null ? BigInt(c.lifetimeBudgetCents) : null,
      currency: c.currency,
      startTime: c.startTime !== null ? new Date(c.startTime) : null,
      endTime: c.endTime !== null ? new Date(c.endTime) : null,
      syncedAt: new Date(),
    };
  }

  private toUpdate(c: MetaCampaignSnapshot) {
    return {
      name: c.name,
      objective: c.objective,
      status: this.mapStatus(c.status),
      dailyBudgetCents: c.dailyBudgetCents !== null ? BigInt(c.dailyBudgetCents) : null,
      lifetimeBudgetCents: c.lifetimeBudgetCents !== null ? BigInt(c.lifetimeBudgetCents) : null,
      currency: c.currency,
      startTime: c.startTime !== null ? new Date(c.startTime) : null,
      endTime: c.endTime !== null ? new Date(c.endTime) : null,
      syncedAt: new Date(),
    };
  }

  private mapStatus(s: MetaCampaignStatus): CampaignStatus {
    switch (s) {
      case 'ACTIVE':
        return CampaignStatus.ACTIVE;
      case 'PAUSED':
        return CampaignStatus.PAUSED;
      case 'DELETED':
        return CampaignStatus.DELETED;
      case 'ARCHIVED':
        return CampaignStatus.ARCHIVED;
      default:
        return CampaignStatus.UNKNOWN;
    }
  }

  private toPublic(row: Campaign, metaAdAccountId: string): PublicCampaign {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      adAccountId: row.adAccountId,
      metaAdAccountId,
      metaCampaignId: row.metaCampaignId,
      name: row.name,
      objective: row.objective,
      status: row.status,
      dailyBudgetCents: row.dailyBudgetCents?.toString() ?? null,
      lifetimeBudgetCents: row.lifetimeBudgetCents?.toString() ?? null,
      currency: row.currency,
      startTime: row.startTime?.toISOString() ?? null,
      endTime: row.endTime?.toISOString() ?? null,
      syncedAt: row.syncedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
