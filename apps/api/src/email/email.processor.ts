import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Job } from 'bullmq';

import { EMAIL_QUEUE } from './email.service.js';

import type { AppConfig } from '../config/configuration.js';
import type {
  EmailJobName,
  InvitationJob,
  PasswordResetJob,
  VerifyEmailJob,
} from './email.service.js';

/**
 * Renders a template + delivers the mail.
 *
 * When RESEND_API_KEY is unset (dev / CI), the processor writes the rendered
 * HTML + the raw token into `tmp/mail/<timestamp>-<name>.json`. The Playwright
 * mailbox helper reads that directory to extract verification / reset /
 * invitation links during e2e runs.
 *
 * The actual React Email templates ship in Phase 11; for now we render a
 * minimal literal-string fallback so the pipeline is testable end-to-end.
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly resend: Resend | undefined;
  private readonly from: string;
  private readonly verifyUrlBase: string;
  private readonly resetUrlBase: string;
  private readonly invitationUrlBase: string;
  private readonly mailDir = join(process.cwd(), 'tmp', 'mail');

  constructor(config: ConfigService<AppConfig, true>) {
    super();
    const email = config.get('email', { infer: true });
    this.from = email.from;
    this.verifyUrlBase = email.verifyUrlBase;
    this.resetUrlBase = email.resetUrlBase;
    this.invitationUrlBase = email.invitationUrlBase;
    this.resend = email.resendApiKey ? new Resend(email.resendApiKey) : undefined;
  }

  async process(job: Job): Promise<void> {
    const name = job.name as EmailJobName;
    switch (name) {
      case 'verify-email':
        return this.sendVerifyEmail(job.data as VerifyEmailJob);
      case 'password-reset':
        return this.sendPasswordReset(job.data as PasswordResetJob);
      case 'invitation':
        return this.sendInvitation(job.data as InvitationJob);
      default: {
        const exhaustive: never = name;
        this.logger.error(`unknown email job: ${String(exhaustive)}`);
      }
    }
  }

  private async sendVerifyEmail(data: VerifyEmailJob): Promise<void> {
    const link = `${this.verifyUrlBase}?token=${encodeURIComponent(data.token)}`;
    await this.send({
      to: data.to,
      subject: 'Email adresini doğrula — Metaflow',
      html: `<p>Merhaba ${data.fullName},</p><p>Hesabını aktifleştirmek için <a href="${link}">buraya tıkla</a>.</p>`,
      jobName: 'verify-email',
      link,
    });
  }

  private async sendPasswordReset(data: PasswordResetJob): Promise<void> {
    const link = `${this.resetUrlBase}?token=${encodeURIComponent(data.token)}`;
    await this.send({
      to: data.to,
      subject: 'Şifre sıfırlama — Metaflow',
      html: `<p>Merhaba ${data.fullName},</p><p>Yeni şifre belirlemek için <a href="${link}">buraya tıkla</a> (1 saat geçerli).</p>`,
      jobName: 'password-reset',
      link,
    });
  }

  private async sendInvitation(data: InvitationJob): Promise<void> {
    const link = `${this.invitationUrlBase}?token=${encodeURIComponent(data.token)}`;
    await this.send({
      to: data.to,
      subject: `${data.inviterName} seni ${data.organizationName}'a davet etti — Metaflow`,
      html: `<p>${data.inviterName}, seni <strong>${data.organizationName}</strong> organizasyonuna <strong>${data.role}</strong> olarak davet etti.</p><p><a href="${link}">Daveti kabul et</a> (7 gün geçerli).</p>`,
      jobName: 'invitation',
      link,
    });
  }

  private async send(input: {
    to: string;
    subject: string;
    html: string;
    jobName: EmailJobName;
    link: string;
  }): Promise<void> {
    if (this.resend) {
      await this.resend.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      this.logger.log({ to: input.to, job: input.jobName }, 'email sent via resend');
      return;
    }

    // Dev / CI fallback: dump to tmp/mail/ so e2e tests can read the token.
    await mkdir(this.mailDir, { recursive: true });
    const file = join(this.mailDir, `${Date.now().toString()}-${input.jobName}-${input.to}.json`);
    await writeFile(
      file,
      JSON.stringify(
        { to: input.to, subject: input.subject, link: input.link, html: input.html },
        null,
        2,
      ),
      'utf8',
    );
    this.logger.warn({ file }, 'email dumped to tmp/mail (resend api key not set)');
  }
}
