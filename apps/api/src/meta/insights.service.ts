import { CampaignStatus, MetaConnectionStatus } from '@metaflow/database';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../auth/services/audit.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { META_API_CLIENT } from './meta-api-client.interface.js';

import type { MetaApiClient } from './meta-api-client.interface.js';

export interface PublicInsightRow {
  campaignId: string;
  date: string; // YYYY-MM-DD
  impressions: string;
  clicks: string;
  spendCents: string;
  conversions: string;
  reach: string;
  frequency: number;
  cpmCents: string | null;
  ctr: number | null;
}

export interface InsightListResult {
  rows: PublicInsightRow[];
  totals: {
    impressions: string;
    clicks: string;
    spendCents: string;
    conversions: string;
  };
  from: string;
  to: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(META_API_CLIENT) private readonly meta: MetaApiClient,
  ) {}

  /**
   * Pulls per-day insights for every ACTIVE / PAUSED campaign in the
   * workspace, upserts them into `meta_insight_snapshots`. Range is
   * inclusive on both ends; idempotent — re-syncing the same window
   * just refreshes the numbers.
   */
  async syncForWorkspace(
    workspaceId: string,
    userId: string,
    from: string,
    to: string,
  ): Promise<{ syncedCount: number }> {
    this.assertRange(from, to);

    const connection = await this.prisma.metaConnection.findFirst({
      where: { workspaceId, status: MetaConnectionStatus.ACTIVE },
      include: { adAccounts: { include: { campaigns: true } } },
    });
    if (!connection) throw new NotFoundException('meta_connection_not_found');

    const accessToken = this.crypto.decrypt(
      connection.accessToken,
      `meta_connection:${workspaceId}`,
    );

    let totalRows = 0;
    for (const ad of connection.adAccounts) {
      const campaigns = ad.campaigns.filter(
        (c) => c.status === CampaignStatus.ACTIVE || c.status === CampaignStatus.PAUSED,
      );
      if (campaigns.length === 0) continue;

      const rows = await this.meta.fetchInsights({
        accessToken,
        metaAdAccountId: ad.metaAdAccountId,
        metaCampaignIds: campaigns.map((c) => c.metaCampaignId),
        from,
        to,
      });

      const campaignByMetaId = new Map(campaigns.map((c) => [c.metaCampaignId, c]));

      for (const row of rows) {
        const campaign = campaignByMetaId.get(row.metaCampaignId);
        if (!campaign) continue;
        await this.prisma.metaInsightSnapshot.upsert({
          where: {
            campaignId_date: { campaignId: campaign.id, date: new Date(row.date) },
          },
          create: {
            campaignId: campaign.id,
            date: new Date(row.date),
            impressions: BigInt(row.impressions),
            clicks: BigInt(row.clicks),
            spendCents: BigInt(row.spendCents),
            conversions: BigInt(row.conversions),
            reach: BigInt(row.reach),
            frequency: row.frequency,
            cpmCents: row.cpmCents !== null ? BigInt(row.cpmCents) : null,
            ctr: row.ctr,
          },
          update: {
            impressions: BigInt(row.impressions),
            clicks: BigInt(row.clicks),
            spendCents: BigInt(row.spendCents),
            conversions: BigInt(row.conversions),
            reach: BigInt(row.reach),
            frequency: row.frequency,
            cpmCents: row.cpmCents !== null ? BigInt(row.cpmCents) : null,
            ctr: row.ctr,
            syncedAt: new Date(),
          },
        });
        totalRows += 1;
      }
    }

    await this.audit.record({
      action: 'insights.fetched',
      userId,
      targetType: 'meta_connection',
      targetId: connection.id,
      metadata: { meta: { workspaceId, from, to, rows: totalRows } },
    });

    return { syncedCount: totalRows };
  }

  async listForWorkspace(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<InsightListResult> {
    this.assertRange(from, to);

    const rows = await this.prisma.metaInsightSnapshot.findMany({
      where: {
        date: { gte: new Date(from), lte: new Date(to) },
        campaign: { workspaceId },
      },
      orderBy: [{ date: 'asc' }, { campaignId: 'asc' }],
    });

    const totals = rows.reduce(
      (acc, r) => ({
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        spendCents: acc.spendCents + r.spendCents,
        conversions: acc.conversions + r.conversions,
      }),
      {
        impressions: 0n,
        clicks: 0n,
        spendCents: 0n,
        conversions: 0n,
      },
    );

    return {
      rows: rows.map((r) => ({
        campaignId: r.campaignId,
        date: r.date.toISOString().slice(0, 10),
        impressions: r.impressions.toString(),
        clicks: r.clicks.toString(),
        spendCents: r.spendCents.toString(),
        conversions: r.conversions.toString(),
        reach: r.reach.toString(),
        frequency: Number(r.frequency.toString()),
        cpmCents: r.cpmCents !== null ? r.cpmCents.toString() : null,
        ctr: r.ctr !== null ? Number(r.ctr.toString()) : null,
      })),
      totals: {
        impressions: totals.impressions.toString(),
        clicks: totals.clicks.toString(),
        spendCents: totals.spendCents.toString(),
        conversions: totals.conversions.toString(),
      },
      from,
      to,
    };
  }

  private assertRange(from: string, to: string): void {
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new BadRequestException('invalid_date_format');
    }
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new BadRequestException('invalid_date');
    }
    if (end < start) throw new BadRequestException('range_inverted');
    const days = (end - start) / 86_400_000 + 1;
    if (days > MAX_RANGE_DAYS) throw new BadRequestException('range_too_wide');
  }
}
