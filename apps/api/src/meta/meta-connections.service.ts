import { MetaConnectionStatus } from '@metaflow/database';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../auth/services/audit.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { META_API_CLIENT } from './meta-api-client.interface.js';

import type { MetaApiClient, MetaTokenSet, MetaUserProfile } from './meta-api-client.interface.js';
import type { MetaConnection } from '@metaflow/database';

interface ConnectInput {
  workspaceId: string;
  userId: string;
  tokens: MetaTokenSet;
  profile: MetaUserProfile;
}

export interface PublicConnection {
  id: string;
  workspaceId: string;
  metaUserId: string;
  displayName: string;
  scopes: string[];
  expiresAt: string | null;
  status: MetaConnectionStatus;
  connectedById: string;
  lastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MetaConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(META_API_CLIENT) private readonly meta: MetaApiClient,
  ) {}

  /**
   * Persists (or upserts on the (workspace, metaUserId) tuple) a freshly
   * exchanged Meta token set. Tokens are AES-256-GCM ciphertext bound to
   * the workspaceId via AAD, so a leaked row can't be replayed against
   * another tenant.
   */
  async connect(input: ConnectInput): Promise<PublicConnection> {
    const aad = this.aad(input.workspaceId);
    const accessCipher = this.crypto.encrypt(input.tokens.accessToken, aad);
    const refreshCipher =
      input.tokens.refreshToken !== undefined
        ? this.crypto.encrypt(input.tokens.refreshToken, aad)
        : null;
    const expiresAt =
      input.tokens.expiresInSeconds !== null
        ? new Date(Date.now() + input.tokens.expiresInSeconds * 1000)
        : null;

    const row = await this.prisma.metaConnection.upsert({
      where: {
        workspaceId_metaUserId: {
          workspaceId: input.workspaceId,
          metaUserId: input.profile.metaUserId,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        metaUserId: input.profile.metaUserId,
        displayName: input.profile.displayName,
        accessToken: accessCipher,
        refreshToken: refreshCipher,
        scopes: input.tokens.scopes,
        expiresAt,
        status: MetaConnectionStatus.ACTIVE,
        connectedById: input.userId,
      },
      update: {
        displayName: input.profile.displayName,
        accessToken: accessCipher,
        refreshToken: refreshCipher,
        scopes: input.tokens.scopes,
        expiresAt,
        status: MetaConnectionStatus.ACTIVE,
        connectedById: input.userId,
        lastRotatedAt: new Date(),
      },
    });

    await this.audit.record({
      action: 'meta.connection.connected',
      userId: input.userId,
      targetType: 'meta_connection',
      targetId: row.id,
      metadata: { meta: { workspaceId: input.workspaceId, scopes: input.tokens.scopes } },
    });

    return this.toPublic(row);
  }

  async getByWorkspace(workspaceId: string): Promise<PublicConnection | null> {
    const row = await this.prisma.metaConnection.findFirst({
      where: { workspaceId, status: MetaConnectionStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toPublic(row) : null;
  }

  /**
   * Returns the decrypted access token for a connection; the only place in
   * the system that hands out plaintext tokens. Callers SHOULD pass the
   * token straight to MetaApiClient and never log it.
   */
  async accessTokenFor(connectionId: string): Promise<string> {
    const row = await this.prisma.metaConnection.findUnique({ where: { id: connectionId } });
    if (row?.status !== MetaConnectionStatus.ACTIVE) {
      throw new NotFoundException('meta_connection_not_found_or_inactive');
    }
    return this.crypto.decrypt(row.accessToken, this.aad(row.workspaceId));
  }

  async rotate(connectionId: string, userId: string): Promise<PublicConnection> {
    const row = await this.prisma.metaConnection.findUnique({ where: { id: connectionId } });
    if (!row) throw new NotFoundException('meta_connection_not_found');
    if (row.status !== MetaConnectionStatus.ACTIVE) {
      throw new BadRequestException('meta_connection_inactive');
    }
    const aad = this.aad(row.workspaceId);
    const currentToken = this.crypto.decrypt(row.accessToken, aad);
    const refreshed = await this.meta.rotate({
      accessToken: currentToken,
      refreshToken:
        row.refreshToken !== null ? this.crypto.decrypt(row.refreshToken, aad) : undefined,
      expiresInSeconds:
        row.expiresAt !== null
          ? Math.max(1, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000))
          : null,
      scopes: row.scopes,
    });

    const updated = await this.prisma.metaConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: this.crypto.encrypt(refreshed.accessToken, aad),
        refreshToken:
          refreshed.refreshToken !== undefined
            ? this.crypto.encrypt(refreshed.refreshToken, aad)
            : row.refreshToken,
        expiresAt:
          refreshed.expiresInSeconds !== null
            ? new Date(Date.now() + refreshed.expiresInSeconds * 1000)
            : null,
        scopes: refreshed.scopes,
        lastRotatedAt: new Date(),
      },
    });

    await this.audit.record({
      action: 'meta.connection.rotated',
      userId,
      targetType: 'meta_connection',
      targetId: connectionId,
    });

    return this.toPublic(updated);
  }

  async disconnect(connectionId: string, userId: string): Promise<void> {
    const row = await this.prisma.metaConnection.findUnique({ where: { id: connectionId } });
    if (!row) throw new NotFoundException('meta_connection_not_found');
    if (row.status === MetaConnectionStatus.REVOKED) return;

    // Best-effort revoke on Meta's side; we always mark our copy revoked
    // regardless so a stuck Meta endpoint can't keep us in a half-state.
    try {
      const token = this.crypto.decrypt(row.accessToken, this.aad(row.workspaceId));
      await this.meta.revoke(token);
    } catch {
      // ignored — local revocation must always succeed
    }

    await this.prisma.metaConnection.update({
      where: { id: connectionId },
      data: { status: MetaConnectionStatus.REVOKED },
    });

    await this.audit.record({
      action: 'meta.connection.disconnected',
      userId,
      targetType: 'meta_connection',
      targetId: connectionId,
    });
  }

  /**
   * Fetches and caches the ad-account list visible through this connection.
   * Replaces the local cache wholesale; downstream consumers should re-read
   * from `meta_ad_accounts`.
   */
  async syncAdAccounts(connectionId: string, userId: string) {
    const row = await this.prisma.metaConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });
    const token = this.crypto.decrypt(row.accessToken, this.aad(row.workspaceId));
    const snapshots = await this.meta.fetchAdAccounts(token);

    await this.prisma.$transaction([
      this.prisma.metaAdAccount.deleteMany({ where: { connectionId } }),
      this.prisma.metaAdAccount.createMany({
        data: snapshots.map((s) => ({
          connectionId,
          metaAdAccountId: s.metaAdAccountId,
          name: s.name,
          currency: s.currency,
          timezone: s.timezone,
          status: s.status,
        })),
      }),
    ]);

    await this.audit.record({
      action: 'meta.adaccounts.synced',
      userId,
      targetType: 'meta_connection',
      targetId: connectionId,
      metadata: { meta: { count: snapshots.length } },
    });

    return snapshots;
  }

  async listAdAccounts(connectionId: string) {
    const rows = await this.prisma.metaAdAccount.findMany({
      where: { connectionId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      metaAdAccountId: r.metaAdAccountId,
      name: r.name,
      currency: r.currency,
      timezone: r.timezone,
      status: r.status,
      syncedAt: r.syncedAt.toISOString(),
    }));
  }

  /**
   * AAD binds ciphertext to its workspace. A row exfiltrated from one tenant
   * cannot be moved into another tenant's column without failing GCM auth.
   */
  private aad(workspaceId: string): string {
    return `meta_connection:${workspaceId}`;
  }

  private toPublic(row: MetaConnection): PublicConnection {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      metaUserId: row.metaUserId,
      displayName: row.displayName,
      scopes: row.scopes,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      status: row.status,
      connectedById: row.connectedById,
      lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
