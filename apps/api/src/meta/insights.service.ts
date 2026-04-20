import { AdSetStatus, AdStatus, CampaignStatus, MetaConnectionStatus } from '@metaflow/database';
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

export interface PublicAdSetInsightRow extends Omit<PublicInsightRow, 'campaignId'> {
  adsetId: string;
}

export interface PublicAdInsightRow extends Omit<PublicInsightRow, 'campaignId'> {
  adId: string;
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

export interface AdSetInsightListResult {
  rows: PublicAdSetInsightRow[];
  totals: InsightListResult['totals'];
  from: string;
  to: string;
}

export interface AdInsightListResult {
  rows: PublicAdInsightRow[];
  totals: InsightListResult['totals'];
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

  async syncForAdSet(
    workspaceId: string,
    userId: string,
    adsetId: string,
    from: string,
    to: string,
  ): Promise<{ syncedCount: number }> {
    this.assertRange(from, to);
    const { accessToken, adset, account } = await this.loadAdSet(workspaceId, adsetId);

    const rows = await this.meta.fetchAdSetInsights({
      accessToken,
      metaAdAccountId: account.metaAdAccountId,
      metaAdSetIds: [adset.metaAdSetId],
      from,
      to,
    });

    for (const row of rows) {
      await this.prisma.metaAdSetInsightSnapshot.upsert({
        where: { adsetId_date: { adsetId: adset.id, date: new Date(row.date) } },
        create: {
          adsetId: adset.id,
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
    }

    await this.audit.record({
      action: 'insights.fetched',
      userId,
      targetType: 'adset',
      targetId: adset.id,
      metadata: { meta: { level: 'adset', from, to, rows: rows.length } },
    });

    return { syncedCount: rows.length };
  }

  async listForAdSet(
    workspaceId: string,
    adsetId: string,
    from: string,
    to: string,
  ): Promise<AdSetInsightListResult> {
    this.assertRange(from, to);

    const adset = await this.prisma.adSet.findFirst({ where: { id: adsetId, workspaceId } });
    if (!adset) throw new NotFoundException('adset_not_found');

    const rows = await this.prisma.metaAdSetInsightSnapshot.findMany({
      where: { adsetId, date: { gte: new Date(from), lte: new Date(to) } },
      orderBy: [{ date: 'asc' }],
    });

    const totals = sumTotals(rows);
    return {
      rows: rows.map((r) => ({
        adsetId: r.adsetId,
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
      totals,
      from,
      to,
    };
  }

  async syncForAd(
    workspaceId: string,
    userId: string,
    adId: string,
    from: string,
    to: string,
  ): Promise<{ syncedCount: number }> {
    this.assertRange(from, to);
    const { accessToken, ad, account } = await this.loadAd(workspaceId, adId);

    const rows = await this.meta.fetchAdInsights({
      accessToken,
      metaAdAccountId: account.metaAdAccountId,
      metaAdIds: [ad.metaAdId],
      from,
      to,
    });

    for (const row of rows) {
      await this.prisma.metaAdInsightSnapshot.upsert({
        where: { adId_date: { adId: ad.id, date: new Date(row.date) } },
        create: {
          adId: ad.id,
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
    }

    await this.audit.record({
      action: 'insights.fetched',
      userId,
      targetType: 'ad',
      targetId: ad.id,
      metadata: { meta: { level: 'ad', from, to, rows: rows.length } },
    });

    return { syncedCount: rows.length };
  }

  async listForAd(
    workspaceId: string,
    adId: string,
    from: string,
    to: string,
  ): Promise<AdInsightListResult> {
    this.assertRange(from, to);

    const ad = await this.prisma.ad.findFirst({ where: { id: adId, workspaceId } });
    if (!ad) throw new NotFoundException('ad_not_found');

    const rows = await this.prisma.metaAdInsightSnapshot.findMany({
      where: { adId, date: { gte: new Date(from), lte: new Date(to) } },
      orderBy: [{ date: 'asc' }],
    });

    const totals = sumTotals(rows);
    return {
      rows: rows.map((r) => ({
        adId: r.adId,
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
      totals,
      from,
      to,
    };
  }

  /**
   * Verifies (workspace, adset) + resolves the parent ad account + decrypts
   * the token in one hop. The ad account is needed because Meta insight
   * queries are scoped to an ad account (`/act_<id>/insights`) with child
   * ids in the filter clause.
   */
  private async loadAdSet(
    workspaceId: string,
    adsetId: string,
  ): Promise<{
    accessToken: string;
    adset: { id: string; metaAdSetId: string };
    account: { metaAdAccountId: string };
  }> {
    const adset = await this.prisma.adSet.findFirst({
      where: { id: adsetId, workspaceId },
      include: { campaign: { include: { adAccount: true } } },
    });
    if (!adset) throw new NotFoundException('adset_not_found');
    if (adset.status === AdSetStatus.DELETED) throw new BadRequestException('adset_deleted');

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
      adset: { id: adset.id, metaAdSetId: adset.metaAdSetId },
      account: { metaAdAccountId: adset.campaign.adAccount.metaAdAccountId },
    };
  }

  private async loadAd(
    workspaceId: string,
    adId: string,
  ): Promise<{
    accessToken: string;
    ad: { id: string; metaAdId: string };
    account: { metaAdAccountId: string };
  }> {
    const ad = await this.prisma.ad.findFirst({
      where: { id: adId, workspaceId },
      include: { campaign: { include: { adAccount: true } } },
    });
    if (!ad) throw new NotFoundException('ad_not_found');
    if (ad.status === AdStatus.DELETED) throw new BadRequestException('ad_deleted');

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
      ad: { id: ad.id, metaAdId: ad.metaAdId },
      account: { metaAdAccountId: ad.campaign.adAccount.metaAdAccountId },
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

interface MetricRow {
  impressions: bigint;
  clicks: bigint;
  spendCents: bigint;
  conversions: bigint;
}

function sumTotals(rows: MetricRow[]): InsightListResult['totals'] {
  const acc = rows.reduce(
    (t, r) => ({
      impressions: t.impressions + r.impressions,
      clicks: t.clicks + r.clicks,
      spendCents: t.spendCents + r.spendCents,
      conversions: t.conversions + r.conversions,
    }),
    { impressions: 0n, clicks: 0n, spendCents: 0n, conversions: 0n },
  );
  return {
    impressions: acc.impressions.toString(),
    clicks: acc.clicks.toString(),
    spendCents: acc.spendCents.toString(),
    conversions: acc.conversions.toString(),
  };
}
