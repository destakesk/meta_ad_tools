/* eslint-disable security/detect-non-literal-fs-filename
   -- Reads files inside __TEST_MAIL_DIR, which is created by globalSetup
      under os.tmpdir(). This helper runs only inside the integration suite. */
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

interface MailDump {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  meta?: Record<string, unknown>;
  /** Convenience: the verify/reset/invitation token if EmailProcessor stored it. */
  token?: string;
  /** When the file was written; useful for newest-first sorting. */
  ts: number;
}

function dir(): string {
  const d = process.env['__TEST_MAIL_DIR'];
  if (!d) throw new Error('Mail dump dir not configured');
  return d;
}

export function readMail(): MailDump[] {
  let files: string[];
  try {
    files = readdirSync(dir()).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((f): MailDump | null => {
      try {
        const raw = readFileSync(join(dir(), f), 'utf8');
        if (raw.length === 0) return null;
        const parsed = JSON.parse(raw) as Omit<MailDump, 'ts'>;
        return { ...parsed, ts: Number(f.split('-')[0] ?? Date.now()) };
      } catch {
        // File still being written — skip; caller polls.
        return null;
      }
    })
    .filter((m): m is MailDump => m !== null)
    .sort((a, b) => b.ts - a.ts);
}

type Template = 'verify-email' | 'password-reset' | 'invitation';

/**
 * Returns the most recent mail addressed to `email`. Polls briefly because
 * mail jobs ride the BullMQ queue and complete out of band. Pass `template`
 * to disambiguate when multiple mails to the same address are in flight
 * (e.g. invitation followed by verify-email after register).
 */
export async function waitForMail(
  email: string,
  options: { template?: Template; timeoutMs?: number } = {},
): Promise<MailDump> {
  const target = email.toLowerCase();
  const timeoutMs = options.timeoutMs ?? 5000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = readMail().find(
      (m) =>
        m.to.toLowerCase() === target &&
        (options.template === undefined || m.template === options.template),
    );
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `No ${options.template ?? 'any'} mail to ${email} within ${timeoutMs.toString()}ms`,
  );
}

export function resetMailbox(): void {
  try {
    const files = readdirSync(dir());
    for (const f of files) rmSync(join(dir(), f), { force: true });
  } catch {
    // dir may not exist yet
  }
}
