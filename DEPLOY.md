# metaflow — production deploy

This is the end-to-end checklist to take metaflow live. Follow the
sections in order. You'll touch four external services: **Railway**
(API + Postgres + Redis), **Vercel** (web), **Resend** (email), and
**Meta for Developers** (OAuth app).

Everywhere you see `<ANGLE_BRACKETS>`, substitute your actual value.

---

## 0. Pick your domain

Pick a base domain first — every other service reads from it.

```
App (web):    app.<your-domain>
API:          api.<your-domain>
Cookie scope: .<your-domain>   (note the leading dot)
```

Example for `metaflow.app`:
- `app.metaflow.app` → Vercel
- `api.metaflow.app` → Railway
- cookies on `.metaflow.app` so web (app.*) can send them to api.*

---

## 1. Resend (email)

1. Sign up at https://resend.com.
2. **Domains → Add Domain** → enter `<your-domain>`. Add the DNS
   records (SPF + DKIM + DMARC) shown in the Resend dashboard to
   your registrar. Wait until Resend marks them verified (usually
   < 10 min).
3. **API Keys → Create API Key** → name it `metaflow-prod`. Scope it
   to "Sending access only" on the domain you just added. Copy the
   key (`re_…`) — you'll paste it into Railway env.
4. Pick a sender address: `noreply@<your-domain>`.

---

## 2. Meta for Developers (real OAuth)

You said you already have Business Manager + verification; skipping
to the app config.

1. https://developers.facebook.com/apps → **Create App**
   → "Business" type.
2. Add **Marketing API** + **Facebook Login for Business** products.
3. **App Settings → Basic**:
   - App Domains: `<your-domain>`
   - Privacy Policy URL: `https://app.<your-domain>/legal/privacy`
     *(put any valid URL here now; final copy can come later)*
   - Terms of Service URL: `https://app.<your-domain>/legal/terms`
4. **Facebook Login for Business → Settings**:
   - Valid OAuth Redirect URIs:
     `https://app.<your-domain>/meta/callback`
5. **App Review → Permissions and Features** → submit for:
   - `ads_management`
   - `ads_read`
   - `business_management`
   You'll need a demo video + a written use-case. Reviews take 2–6
   weeks. **While waiting, the app works for test users / test ad
   accounts inside your own Business Manager.** That's enough for
   internal testing; you block on approval before onboarding a
   third-party workspace.
6. Copy **App ID** + **App Secret** (App Settings → Basic). You'll
   paste these into Railway.

---

## 3. Railway (API + Postgres + Redis)

### 3.1 Project

1. https://railway.app → **New Project** → **Deploy from GitHub repo**
   → pick `destakesk/meta_ad_tools`.
2. Railway will detect the Dockerfile at `apps/api/Dockerfile` via
   the committed `apps/api/railway.toml`. Set the service name to
   `api`.

### 3.2 Postgres

1. In the project → **New → Database → PostgreSQL**.
2. Note: Railway auto-injects `DATABASE_URL` into the API service if
   you reference it. Under the `api` service → **Variables → Add
   reference** → pick the Postgres plugin's `DATABASE_URL`.

### 3.3 Redis

1. **New → Database → Redis**.
2. Same pattern — reference its `REDIS_URL` from `api`.

### 3.4 API env variables

Under `api` → **Variables → Raw editor**, paste:

```
# ---- Runtime ----
NODE_ENV=production
PORT=3001
APP_NAME=metaflow
APP_URL=https://app.<your-domain>
API_URL=https://api.<your-domain>
CORS_ORIGINS=https://app.<your-domain>

LOG_LEVEL=info

# ---- Database / Redis ----
# These come from references you set up above.
# DATABASE_URL — referenced
# REDIS_URL    — referenced
REDIS_PREFIX=metaflow:

# ---- Cookies ----
COOKIE_SECURE=true
COOKIE_DOMAIN=.<your-domain>

# ---- Email (Resend) ----
RESEND_API_KEY=re_<from-resend>
EMAIL_FROM=noreply@<your-domain>
EMAIL_VERIFY_URL_BASE=https://app.<your-domain>/verify-email
PASSWORD_RESET_URL_BASE=https://app.<your-domain>/reset-password
INVITATION_URL_BASE=https://app.<your-domain>/invite/accept

# ---- Meta real OAuth ----
META_OAUTH_MODE=real
META_APP_ID=<from-meta-dashboard>
META_APP_SECRET=<from-meta-dashboard>
META_REDIRECT_URI=https://app.<your-domain>/meta/callback
META_SCOPES=ads_management,ads_read,business_management
META_OAUTH_STATE_TTL_SECONDS=600
```

Then generate the cryptographic secrets locally and paste them too:

```
node --experimental-strip-types apps/api/scripts/generate-prod-secrets.ts
```

That prints another block including `JWT_SECRET`, `MFA_TOKEN_SECRET`,
`ENCRYPTION_KEY`, plus sensible TTL + throttle defaults. Paste the
output into Railway's Raw editor under the block above. **Store the
output somewhere safe (1Password, etc.) — if you lose
`ENCRYPTION_KEY`, every Meta-connection token in the DB becomes
unreadable.**

### 3.5 Custom domain

Under `api` service → **Settings → Networking → Custom Domain** →
add `api.<your-domain>`. Railway prints a CNAME target; point your
registrar's `api` record at it. Wait for the green checkmark.

### 3.6 Deploy

Push to `main` (or click "Deploy" in Railway). The container runs
`prisma migrate deploy` on boot, then starts the API. First deploy
should take ~2-3 min.

Verify: `curl https://api.<your-domain>/health/ready` returns
`{"success":true,"data":{"status":"ok"}}`.

---

## 4. Vercel (web)

1. https://vercel.com/new → import `destakesk/meta_ad_tools`.
2. **Framework Preset:** Next.js (auto-detected).
3. **Root Directory:** `apps/web`. Vercel reads `apps/web/vercel.json`
   and picks up the monorepo-aware install + build commands from it.
4. **Environment variables** (Settings → Environment Variables):

   ```
   NEXT_PUBLIC_APP_URL=https://app.<your-domain>
   NEXT_PUBLIC_API_URL=https://api.<your-domain>
   ```

   Apply to: Production + Preview + Development.

5. **Deploy.**
6. **Domains:** add `app.<your-domain>`. Vercel prints DNS records;
   add the CNAME at your registrar.

---

## 5. First-time setup on the live app

Visit `https://app.<your-domain>`. Register an account. Check your
inbox for the verification mail (from Resend). Click the link → you
land back on the app with email verified. Proceed through MFA setup
and login — same flow as local dev, just over HTTPS with real email
delivery.

Then: Settings → Meta integration → Connect. You'll bounce to
Facebook's OAuth dialog, grant the scopes, and land back on the app
with an active connection. Sync ad accounts → sync campaigns → rest
of the product works end-to-end.

---

## 6. Day-2 operations

**Migrations:** on every push to `main`, the API container rebuilds
and applies any new migrations on boot (idempotent). Rolling back =
redeploy the previous revision in Railway.

**Secrets rotation:** rotate `JWT_SECRET` and `MFA_TOKEN_SECRET`
whenever you suspect leakage. All active sessions get invalidated;
users re-login. **Never** rotate `ENCRYPTION_KEY` without first
re-encrypting every `meta_connections.access_token` row — that
column is AES-256-GCM with this key as the AAD key, and rotating it
blind breaks every existing connection.

**Backups:** Railway Postgres has point-in-time recovery on paid
plans. Turn it on. On the free tier, schedule a nightly `pg_dump` via
a cron service (Railway cron, GitHub Actions, etc.) and push the dump
to S3 / R2.

**Scaling:** the API is stateless (session data lives in Postgres,
rate-limits + queue in Redis). Bump Railway replicas horizontally
when needed. Web on Vercel scales automatically.

**Cost estimate (small SaaS):** Railway ~$20/mo (API + Postgres +
Redis), Vercel free tier, Resend free tier up to 3k/mo, Meta app
free. ~$20-30/mo baseline.

---

## Troubleshooting

- **API boots but login is 500:** `ENCRYPTION_KEY` is probably not
  exactly 32 bytes base64. Regenerate with the script above.
- **Login succeeds but web shows "Organizasyon bilgisi yüklenemedi
  (unauthorized)":** `CORS_ORIGINS` on the API doesn't include the
  web's exact origin (including protocol). Make sure it's
  `https://app.<your-domain>` without a trailing slash.
- **Meta OAuth fails with "URL Blocked":** the redirect URI in the
  Meta app doesn't match `META_REDIRECT_URI`. They must match
  character-for-character including trailing slashes.
- **Email not arriving:** check Resend dashboard → Activity. Usually
  SPF/DKIM not fully propagated or sender domain mismatch.
- **MFA setup loops:** clock skew on the container. Railway's hosts
  are NTP-synced, so this usually means the user's device is off —
  check their system time.
