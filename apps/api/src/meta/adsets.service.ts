import { AdSetStatus, MetaConnectionStatus } from '@metaflow/database';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../auth/services/audit.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { META_API_CLIENT } from './meta-api-client.interface.js';

import type {
  MetaAdSetSnapshot,
  MetaAdSetStatus,
  MetaApiClient,
} from './meta-api-client.interface.js';
import type { AdSet } from '@metaflow/database';

export interface CreateAdSetInput {
  campaignId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  optimizationGoal: string;
  billingEvent: string;
  dailyBudgetCents?: string;
  lifetimeBudgetCents?: string;
  startTime?: string;
  endTime?: string;
  targeting?: unknown;
}

export interface UpdateAdSetInput {
  name?: string;
  status?: 'ACTIVE' | 'PAUSED';
  dailyBudgetCents?: string | null;
  lifetimeBudgetCents?: string | null;
  endTime?: string | null;
  targeting?: unknown;
}

export interface PublicAdSet {
  id: string;
  workspaceId: string;
  campaignId: string;
  metaAdSetId: string;
  name: string;
  status: AdSetStatus;
  optimizationGoal: string | null;
  billingEvent: string | null;
  dailyBudgetCents: string | null;
  lifetimeBudgetCents: string | null;
  startTime: string | null;
  endTime: string | null;
  targeting: unknown;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AdSetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(META_API_CLIENT) private readonly meta: MetaApiClient,
  ) {}

  async syncForCampaign(
    workspaceId: string,
    userId: string,
    campaignId: string,
  ): Promise<{ syncedCount: number }> {
    const { accessToken, campaign } = await this.loadCampaign(workspaceId, campaignId);

    const remote = await this.meta.fetchAdSets({
      accessToken,
      metaCampaignId: campaign.metaCampaignId,
    });

    for (const snapshot of remote) {
      await this.prisma.adSet.upsert({
        where: {
          campaignId_metaAdSetId: {
            campaignId: campaign.id,
            metaAdSetId: snapshot.metaAdSetId,
          },
        },
        create: this.toCreate(workspaceId, campaign.id, snapshot),
        update: this.toUpdate(snapshot),
      });
    }

    await this.prisma.adSet.updateMany({
      where: {
        campaignId: campaign.id,
        metaAdSetId: { notIn: remote.map((r) => r.metaAdSetId) },
        status: { not: AdSetStatus.DELETED },
      },
      data: { status: AdSetStatus.DELETED, syncedAt: new Date() },
    });

    await this.audit.record({
      action: 'adset.synced',
      userId,
      targetType: 'campaign',
      targetId: campaign.id,
      metadata: { meta: { count: remote.length } },
    });

    return { syncedCount: remote.length };
  }

  async listForCampaign(workspaceId: string, campaignId: string): Promise<PublicAdSet[]> {
    // Verify campaign belongs to this workspace before listing its ad sets.
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
    });
    if (!campaign) throw new NotFoundException('campaign_not_found');

    const rows = await this.prisma.adSet.findMany({
      where: { campaignId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toPublic(r));
  }

  async getById(workspaceId: string, id: string): Promise<PublicAdSet> {
    const row = await this.prisma.adSet.findFirst({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('adset_not_found');
    return this.toPublic(row);
  }

  async create(workspaceId: string, userId: string, input: CreateAdSetInput): Promise<PublicAdSet> {
    if (
      (input.dailyBudgetCents === undefined && input.lifetimeBudgetCents === undefined) ||
      (input.dailyBudgetCents !== undefined && input.lifetimeBudgetCents !== undefined)
    ) {
      throw new BadRequestException('budget_exactly_one_required');
    }

    const { accessToken, campaign } = await this.loadCampaign(workspaceId, input.campaignId);

    const snapshot = await this.meta.createAdSet({
      accessToken,
      metaCampaignId: campaign.metaCampaignId,
      name: input.name,
      status: input.status,
      optimizationGoal: input.optimizationGoal,
      billingEvent: input.billingEvent,
      ...(input.dailyBudgetCents !== undefined ? { dailyBudgetCents: input.dailyBudgetCents } : {}),
      ...(input.lifetimeBudgetCents !== undefined
        ? { lifetimeBudgetCents: input.lifetimeBudgetCents }
        : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.targeting !== undefined ? { targeting: input.targeting } : {}),
    });

    const row = await this.prisma.adSet.create({
      data: this.toCreate(workspaceId, campaign.id, snapshot),
    });

    await this.audit.record({
      action: 'adset.created',
      userId,
      targetType: 'adset',
      targetId: row.id,
    });

    return this.toPublic(row);
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateAdSetInput,
  ): Promise<PublicAdSet> {
    const existing = await this.prisma.adSet.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('adset_not_found');
    if (existing.status === AdSetStatus.DELETED) {
      throw new BadRequestException('adset_deleted');
    }

    const { accessToken } = await this.loadCampaign(workspaceId, existing.campaignId);

    const snapshot = await this.meta.updateAdSet({
      accessToken,
      metaAdSetId: existing.metaAdSetId,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.dailyBudgetCents !== undefined ? { dailyBudgetCents: input.dailyBudgetCents } : {}),
      ...(input.lifetimeBudgetCents !== undefined
        ? { lifetimeBudgetCents: input.lifetimeBudgetCents }
        : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.targeting !== undefined ? { targeting: input.targeting } : {}),
    });

    const row = await this.prisma.adSet.update({
      where: { id },
      data: this.toUpdate(snapshot),
    });

    await this.audit.record({
      action: 'adset.updated',
      userId,
      targetType: 'adset',
      targetId: row.id,
    });

    return this.toPublic(row);
  }

  async delete(workspaceId: string, userId: string, id: string): Promise<void> {
    const existing = await this.prisma.adSet.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('adset_not_found');
    if (existing.status === AdSetStatus.DELETED) return;

    const { accessToken } = await this.loadCampaign(workspaceId, existing.campaignId);

    await this.meta.deleteAdSet({
      accessToken,
      metaAdSetId: existing.metaAdSetId,
    });

    await this.prisma.adSet.update({
      where: { id },
      data: { status: AdSetStatus.DELETED, syncedAt: new Date() },
    });

    await this.audit.record({
      action: 'adset.deleted',
      userId,
      targetType: 'adset',
      targetId: id,
    });
  }

  /**
   * Shared: verifies (workspace, campaign) + decrypts the Meta token. All
   * AdSet write endpoints route through this so we never have to re-derive
   * the invariants.
   */
  private async loadCampaign(
    workspaceId: string,
    campaignId: string,
  ): Promise<{
    accessToken: string;
    campaign: { id: string; metaCampaignId: string; adAccountId: string };
  }> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
    });
    if (!campaign) throw new NotFoundException('campaign_not_found');

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
      campaign: {
        id: campaign.id,
        metaCampaignId: campaign.metaCampaignId,
        adAccountId: campaign.adAccountId,
      },
    };
  }

  private toCreate(workspaceId: string, campaignId: string, s: MetaAdSetSnapshot) {
    return {
      workspaceId,
      campaignId,
      metaAdSetId: s.metaAdSetId,
      name: s.name,
      status: this.mapStatus(s.status),
      optimizationGoal: s.optimizationGoal,
      billingEvent: s.billingEvent,
      dailyBudgetCents: s.dailyBudgetCents !== null ? BigInt(s.dailyBudgetCents) : null,
      lifetimeBudgetCents: s.lifetimeBudgetCents !== null ? BigInt(s.lifetimeBudgetCents) : null,
      startTime: s.startTime !== null ? new Date(s.startTime) : null,
      endTime: s.endTime !== null ? new Date(s.endTime) : null,
      targeting: (s.targeting ?? null) as never,
      syncedAt: new Date(),
    };
  }

  private toUpdate(s: MetaAdSetSnapshot) {
    return {
      name: s.name,
      status: this.mapStatus(s.status),
      optimizationGoal: s.optimizationGoal,
      billingEvent: s.billingEvent,
      dailyBudgetCents: s.dailyBudgetCents !== null ? BigInt(s.dailyBudgetCents) : null,
      lifetimeBudgetCents: s.lifetimeBudgetCents !== null ? BigInt(s.lifetimeBudgetCents) : null,
      startTime: s.startTime !== null ? new Date(s.startTime) : null,
      endTime: s.endTime !== null ? new Date(s.endTime) : null,
      targeting: (s.targeting ?? null) as never,
      syncedAt: new Date(),
    };
  }

  private mapStatus(s: MetaAdSetStatus): AdSetStatus {
    switch (s) {
      case 'ACTIVE':
        return AdSetStatus.ACTIVE;
      case 'PAUSED':
        return AdSetStatus.PAUSED;
      case 'DELETED':
        return AdSetStatus.DELETED;
      case 'ARCHIVED':
        return AdSetStatus.ARCHIVED;
      default:
        return AdSetStatus.UNKNOWN;
    }
  }

  private toPublic(row: AdSet): PublicAdSet {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      campaignId: row.campaignId,
      metaAdSetId: row.metaAdSetId,
      name: row.name,
      status: row.status,
      optimizationGoal: row.optimizationGoal,
      billingEvent: row.billingEvent,
      dailyBudgetCents: row.dailyBudgetCents?.toString() ?? null,
      lifetimeBudgetCents: row.lifetimeBudgetCents?.toString() ?? null,
      startTime: row.startTime?.toISOString() ?? null,
      endTime: row.endTime?.toISOString() ?? null,
      targeting: row.targeting,
      syncedAt: row.syncedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
