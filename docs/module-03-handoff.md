# Module 03 handoff — Meta OAuth + BISU tokens

Module 02 (Auth + User Management) is complete. The pieces below are the
contracts Module 03 inherits and the work it should pick up first.

---

## What's already wired for you

### Permissions (seeded)

The PERMISSIONS catalogue already includes the BISU triplet that Module 03
will guard:

- `bisu:connect`
- `bisu:rotate`
- `bisu:disconnect`

These are workspace-scoped. WS_ADMIN, ORG_ADMIN, and ORG_OWNER have them by
default; WS_MANAGER + WS_VIEWER do not. See
`packages/database/src/data/role-permissions.ts`. No new seed work required —
the integration tests already cover that the resolver hands these out
correctly.

### CryptoService

`apps/api/src/crypto/crypto.service.ts` provides AES-256-GCM with the `v1:`
prefix and AAD tagging:

```ts
crypto.encrypt(plaintext, aad)  // → 'v1:<base64>'
crypto.decrypt(ciphertext, aad) // → plaintext
```

Use the **userId** as AAD when storing per-user secrets (mirrors how
`MfaService` stores TOTP secrets). For BISU tokens the AAD should be
something like `bisu:<workspaceId>:<adAccountId>` so a leaked ciphertext
can't be replayed against the wrong workspace.

`ENCRYPTION_KEY` is the rotation root. New keys go in as `ENCRYPTION_KEY_V2`
etc. when we need them; the `v1:` prefix carries the version so old data
keeps decrypting.

### SessionService

`apps/api/src/auth/services/session.service.ts` already does refresh-token
rotation with theft detection (`rotate()` revokes every active session for
the user when it sees a stale token). Reuse this for any "long-lived
external session" that needs the same shape.

### AuditService

`audit.record({ action, userId, targetType?, targetId?, metadata? })` enqueues
to the `audit-queue` BullMQ queue → AuditProcessor writes a row into
`audit_logs`. Add new actions to `AuditAction` in
`packages/shared-types/src/audit.ts`. For Module 03, expect at minimum:

- `bisu.connected`
- `bisu.rotated`
- `bisu.disconnected`
- `meta.oauth.callback.success`
- `meta.oauth.callback.failed`

Add them to the enum, then the type-checker will tell you everywhere they
need to be wired.

### PermissionGuard / @RequirePermission

```ts
@Post(':slug/bisu/connect')
@RequirePermission('bisu:connect')
async connect(...) { ... }
```

Workspace-scoped permissions need `:slug` in the route path so
`WorkspaceAccessGuard` populates the request context first. Don't forget the
guard order: `JwtAuthGuard → EmailVerifiedGuard → CustomHeaderGuard →
WorkspaceAccessGuard → PermissionGuard`.

### Frontend `useCan`

`apps/web/src/lib/auth/use-can.ts` already returns booleans for any
`PermissionKey`. Use it on Module 03 UI to hide / disable controls:

```tsx
const canConnect = useCan('bisu:connect');
return canConnect ? <ConnectButton /> : null;
```

`PermissionKey` autocomplete includes the BISU keys.

### Mailbox helper

If Module 03 sends transactional mail, follow the EmailProcessor pattern:
add a `<name>Job` interface to `email.service.ts`, an `enqueue<Name>` method,
and a render+send branch in `email.processor.ts`. The dev fallback already
honors `MAIL_DUMP_DIR`, and integration / e2e tests can lift the existing
`waitForMail()` helpers verbatim.

---

## Suggested first cuts for Module 03

1. **Database**: add `MetaConnection` + `BisuToken` Prisma models. BISU token
   ciphertext stored as `String`; expiry / scope columns plain. Migration
   should set NOT NULL on user-required fields and `onDelete: Cascade` from
   workspace.
2. **Service**: `BisuService` with `connect / rotate / disconnect` methods,
   each calling CryptoService with the workspace-scoped AAD and writing an
   audit event.
3. **Controller**: workspace-scoped `BisuController` mounted at
   `/workspaces/:slug/bisu/*`, gated by the `bisu:*` permissions.
4. **Frontend**: workspace settings page already exists at
   `/w/[slug]/settings`. Add a "Meta connection" section that uses
   `useCan('bisu:connect')` to gate the connect button and shows the current
   token status.
5. **Tests**:
   - Unit: BisuService crypto round-trip + audit record assertions.
   - Integration: add a spec under `apps/api/test/integration/` exercising
     connect → rotate → disconnect against a real workspace, asserting
     audit-log rows.
   - E2E: extend the workspace settings spec to cover the connect-then-rotate
     UI.

---

## Don'ts

- Don't roll a new auth primitive — Module 02's `SessionService`,
  `TokenService`, and `AuthRateLimitService` already cover every shape we'll
  need for Module 03.
- Don't store Meta tokens unencrypted, even briefly. Always go through
  `CryptoService.encrypt(token, aad)`.
- Don't bypass `WorkspaceAccessGuard` to "save a roundtrip" — the guard is
  what populates `CurrentWorkspace`, and route handlers depend on that
  context being present.
- Don't add `@Public()` to BISU endpoints. Even the OAuth callback should
  carry session context (use a CSRF state cookie set during the kick-off).

---

## Quick reference

| You want…                      | Reach for                                         |
|--------------------------------|---------------------------------------------------|
| Per-user secret crypto         | `CryptoService.encrypt/decrypt` (AAD = userId)    |
| Per-workspace secret crypto    | `CryptoService.encrypt/decrypt` (AAD = workspaceId scoping) |
| Rate-limit a route             | `@Throttle({ default: { limit, ttl } })`          |
| Custom failure counter         | `AuthRateLimitService.register(key, …)`           |
| Audit a security event         | `AuditService.record({ action, userId, … })`      |
| Permission check (server)      | `@RequirePermission('key')` + `PermissionGuard`   |
| Permission check (client UI)   | `useCan('key')`                                   |
| Send a transactional email     | `EmailService.enqueue<Name>(…)` + new processor case |
| Start an integration test      | Copy `apps/api/test/integration/auth-logout.spec.ts` as a template |

Ship it.
