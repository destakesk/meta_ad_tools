/**
 * Permission catalogue — single source of truth.
 *
 * Adding a new permission is a code change:
 *   1. Add entry here.
 *   2. Reference it in role-permissions.ts under the relevant roles.
 *   3. Run `pnpm db:seed` (idempotent upsert).
 */
export interface PermissionDef {
  key: string;
  description: string;
  scope: 'organization' | 'workspace';
}

const ORG_PERMISSIONS: PermissionDef[] = [
  { key: 'org:read', description: 'Organization bilgilerini görüntüleme', scope: 'organization' },
  { key: 'org:update', description: 'Organization ayarlarını değiştirme', scope: 'organization' },
  { key: 'org:delete', description: 'Organization silme', scope: 'organization' },
  { key: 'member:invite', description: 'Yeni üye davet etme', scope: 'organization' },
  { key: 'member:remove', description: 'Üye çıkarma', scope: 'organization' },
  { key: 'member:role:update', description: 'Üye rolünü değiştirme', scope: 'organization' },
  { key: 'workspace:create', description: 'Yeni workspace yaratma', scope: 'organization' },
  { key: 'workspace:delete', description: 'Workspace silme', scope: 'organization' },
  { key: 'billing:view', description: 'Billing görüntüleme', scope: 'organization' },
  { key: 'billing:manage', description: 'Ödeme yönetimi', scope: 'organization' },
  { key: 'audit:view', description: 'Audit log görüntüleme', scope: 'organization' },
];

const WORKSPACE_PERMISSIONS: PermissionDef[] = [
  { key: 'workspace:read', description: 'Workspace görüntüleme', scope: 'workspace' },
  { key: 'workspace:update', description: 'Workspace ayarları düzenleme', scope: 'workspace' },
  { key: 'bisu:connect', description: 'Meta BISU token bağlama', scope: 'workspace' },
  { key: 'bisu:rotate', description: 'BISU token yenileme', scope: 'workspace' },
  { key: 'bisu:disconnect', description: 'BISU bağlantıyı kaldırma', scope: 'workspace' },
  { key: 'adaccount:read', description: 'Ad account listeleme', scope: 'workspace' },
  { key: 'adaccount:connect', description: 'Ad account bağlama', scope: 'workspace' },
  { key: 'campaign:read', description: 'Campaign görüntüleme', scope: 'workspace' },
  { key: 'campaign:write', description: 'Campaign yaratma/güncelleme', scope: 'workspace' },
  { key: 'campaign:delete', description: 'Campaign silme', scope: 'workspace' },
  { key: 'adset:write', description: 'Ad set yaratma/güncelleme', scope: 'workspace' },
  { key: 'adset:delete', description: 'Ad set silme', scope: 'workspace' },
  { key: 'ad:write', description: 'Ad yaratma/güncelleme', scope: 'workspace' },
  { key: 'ad:delete', description: 'Ad silme', scope: 'workspace' },
  { key: 'budget:edit', description: 'Bütçe değiştirme', scope: 'workspace' },
  { key: 'creative:read', description: 'Creative library görme', scope: 'workspace' },
  { key: 'creative:write', description: 'Creative upload/edit', scope: 'workspace' },
  { key: 'creative:delete', description: 'Creative silme', scope: 'workspace' },
  { key: 'template:read', description: 'Template listeleme', scope: 'workspace' },
  { key: 'template:write', description: 'Template yaratma/düzenleme', scope: 'workspace' },
  { key: 'brandkit:read', description: 'Brand kit görme', scope: 'workspace' },
  { key: 'brandkit:write', description: 'Brand kit düzenleme', scope: 'workspace' },
  { key: 'automation:read', description: 'Automation rule listeleme', scope: 'workspace' },
  { key: 'automation:write', description: 'Automation rule yaratma/düzenleme', scope: 'workspace' },
  { key: 'automation:enable', description: 'Automation aktif/pasif etme', scope: 'workspace' },
  { key: 'abtest:read', description: 'A/B test görüntüleme', scope: 'workspace' },
  { key: 'abtest:write', description: 'A/B test başlatma/durdurma', scope: 'workspace' },
  { key: 'insights:read', description: 'Analytics görme', scope: 'workspace' },
  { key: 'report:read', description: 'Rapor görme', scope: 'workspace' },
  { key: 'report:export', description: 'Rapor export', scope: 'workspace' },
  { key: 'ai:use', description: 'AI generation kullanma', scope: 'workspace' },
  { key: 'lead:read', description: 'Lead data görme', scope: 'workspace' },
  { key: 'lead:export', description: 'Lead export', scope: 'workspace' },
];

export const PERMISSIONS: readonly PermissionDef[] = [...ORG_PERMISSIONS, ...WORKSPACE_PERMISSIONS];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as readonly string[];

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];
