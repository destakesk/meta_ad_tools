import { randomBytes } from 'node:crypto';

/**
 * Prints a block of production-grade secrets ready to paste into the
 * Railway "Variables" panel. Run with:
 *
 *   node --experimental-strip-types apps/api/scripts/generate-prod-secrets.ts
 *
 * The only "tricky" value is ENCRYPTION_KEY: it must be exactly 32 bytes
 * base64-encoded (AES-256-GCM). Everything else is a long opaque string.
 *
 * Run once per environment (staging + production keep separate secrets).
 * DO NOT commit the output.
 */

const b64 = (bytes: number): string => randomBytes(bytes).toString('base64');
const hex = (bytes: number): string => randomBytes(bytes).toString('hex');

console.log(`# ---- Paste into Railway → API service → Variables ----

JWT_SECRET=${hex(48)}
MFA_TOKEN_SECRET=${hex(48)}
ENCRYPTION_KEY=${b64(32)}

# Session / cookie security
COOKIE_SECURE=true
# Set this AFTER you know your public domain — e.g. ".metaflow.app"
# leaving off lets the cookie land on the API host only (safer default).
# COOKIE_DOMAIN=.your-domain.app

# Token lifetimes — tweak if you want longer sessions
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=604800
BCRYPT_COST=12
EMAIL_VERIFY_TOKEN_TTL_SECONDS=86400
PASSWORD_RESET_TOKEN_TTL_SECONDS=3600
INVITATION_TTL_SECONDS=604800
MFA_SETUP_TOKEN_TTL_SECONDS=300
MFA_CHALLENGE_TOKEN_TTL_SECONDS=300

# Rate limiter (requests per TTL window)
THROTTLE_TTL=60
THROTTLE_LIMIT=120
`);
