import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/* eslint-disable security/detect-non-literal-fs-filename
   -- Reads from a deterministic per-suite directory (tests/e2e/.mailbox/). */

interface MailDump {
  to: string;
  subject: string;
  template: 'verify-email' | 'password-reset' | 'invitation';
  link: string;
  token: string;
  ts: number;
}

const MAIL_DIR = process.env['MAIL_DUMP_DIR'] ?? join(process.cwd(), 'tests', 'e2e', '.mailbox');

function readAll(): MailDump[] {
  let files: string[];
  try {
    files = readdirSync(MAIL_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((f): MailDump | null => {
      try {
        const raw = readFileSync(join(MAIL_DIR, f), 'utf8');
        if (raw.length === 0) return null;
        const parsed = JSON.parse(raw) as Omit<MailDump, 'ts'>;
        return { ...parsed, ts: Number(f.split('-')[0] ?? Date.now()) };
      } catch {
        return null;
      }
    })
    .filter((m): m is MailDump => m !== null)
    .sort((a, b) => b.ts - a.ts);
}

/**
 * Polls the on-disk mail dump dir for a mail addressed to `email`. Pass
 * `template` to disambiguate when multiple mails to the same address are
 * in flight (invitation followed by verify-email after register).
 */
export async function waitForMail(
  email: string,
  options: { template?: MailDump['template']; timeoutMs?: number } = {},
): Promise<MailDump> {
  const target = email.toLowerCase();
  const timeoutMs = options.timeoutMs ?? 8000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = readAll().find(
      (m) =>
        m.to.toLowerCase() === target &&
        (options.template === undefined || m.template === options.template),
    );
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(
    `No ${options.template ?? 'any'} mail to ${email} within ${timeoutMs.toString()}ms`,
  );
}

export function clearMailbox(): void {
  try {
    for (const f of readdirSync(MAIL_DIR)) rmSync(join(MAIL_DIR, f), { force: true });
  } catch {
    // dir may not exist yet
  }
}

/* eslint-enable security/detect-non-literal-fs-filename */
