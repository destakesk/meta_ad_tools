import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';

import type { Queue } from 'bullmq';

export const EMAIL_QUEUE = 'email-queue';

export type EmailJobName = 'verify-email' | 'password-reset' | 'invitation';

export interface VerifyEmailJob {
  to: string;
  fullName: string;
  token: string;
  locale: 'tr' | 'en';
}

export interface PasswordResetJob {
  to: string;
  fullName: string;
  token: string;
  locale: 'tr' | 'en';
}

export interface InvitationJob {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  token: string;
  locale: 'tr' | 'en';
}

export type EmailJob = VerifyEmailJob | PasswordResetJob | InvitationJob;

/**
 * Enqueues outbound emails onto the `email-queue` BullMQ queue. The
 * `EmailProcessor` renders the React Email template + sends via Resend
 * (or writes to `tmp/mail/` when no Resend API key is set — Module 02
 * dev-mode fallback used by e2e tests).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Optional()
    @InjectQueue(EMAIL_QUEUE)
    private readonly queue: Queue | undefined,
  ) {}

  async enqueueVerifyEmail(data: VerifyEmailJob): Promise<void> {
    await this.enqueue('verify-email', data);
  }

  async enqueuePasswordReset(data: PasswordResetJob): Promise<void> {
    await this.enqueue('password-reset', data);
  }

  async enqueueInvitation(data: InvitationJob): Promise<void> {
    await this.enqueue('invitation', data);
  }

  private async enqueue(name: EmailJobName, data: EmailJob): Promise<void> {
    if (!this.queue) {
      this.logger.warn({ name, data }, 'email queue unavailable — email not sent');
      return;
    }
    await this.queue.add(name, data);
  }
}
