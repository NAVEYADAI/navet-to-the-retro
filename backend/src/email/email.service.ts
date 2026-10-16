import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// BUG-23: user-controlled strings (team name, names, office) are interpolated into HTML templates.
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Subjects are plain text (not HTML) — only strip line breaks to prevent header injection.
function sanitizeSubject(value: string): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  // BUG-59: Resend's shared sender only delivers to the account owner, so when SMTP_USER/SMTP_PASS are set
  // (e.g. Gmail + App Password) mail goes through SMTP instead and reaches any recipient.
  private readonly smtp: Transporter | null;
  private readonly fromAddress: string;
  private readonly frontendUrl = process.env.FRONTEND_URL || 'https://navet-to-retro-frontend.fly.dev';

  constructor() {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    this.smtp =
      smtpUser && smtpPass
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: (Number(process.env.SMTP_PORT) || 465) === 465,
            auth: { user: smtpUser, pass: smtpPass }
          })
        : null;
    this.fromAddress =
      process.env.EMAIL_FROM || (this.smtp ? `נווט לרט <${smtpUser}>` : 'Retro App <onboarding@resend.dev>');

    const apiKey = process.env.RESEND_API_KEY;
    this.client = !this.smtp && apiKey ? new Resend(apiKey) : null;
    if (!this.smtp && !this.client) {
      this.logger.warn('Neither SMTP_USER/SMTP_PASS nor RESEND_API_KEY is set — emails will be logged but not sent.');
    }
  }

  private get canSend() {
    return Boolean(this.smtp || this.client);
  }

  private async deliver(to: string, subject: string, html: string) {
    if (this.smtp) {
      await this.smtp.sendMail({ from: this.fromAddress, to, subject, html });
      return;
    }
    // Resend reports failures (e.g. 403 for unverified senders) in the result instead of throwing.
    const result = await this.client!.emails.send({ from: this.fromAddress, to, subject, html });
    if (result?.error) {
      throw new Error(`Resend rejected the email: ${result.error.message ?? JSON.stringify(result.error)}`);
    }
  }

  async sendTeamApprovalRequest(params: {
    to: string;
    teamName: string;
    creatorName: string;
    mainOffice?: string | null;
  }) {
    const { to, teamName, creatorName, mainOffice } = params;
    const subject = sanitizeSubject(`בקשת אישור להקמת צוות: ${teamName}`);
    const html = `
      <div dir="rtl" style="font-family: sans-serif; text-align: right;">
        <h2>בקשה לאישור צוות חדש</h2>
        <p>${escapeHtml(creatorName)} ביקש/ה להקים את הצוות "<strong>${escapeHtml(teamName)}</strong>"${mainOffice ? ` (${escapeHtml(mainOffice)})` : ''} ומינה/תה אותך כמאשר/ת.</p>
        <p>הצוות יהפוך לפעיל רק לאחר שתאשר/י אותו באפליקציה.</p>
        <p><a href="${this.frontendUrl}">פתח/י את האפליקציה כדי לאשר או לדחות</a></p>
      </div>
    `;

    if (!this.canSend) {
      this.logger.warn(`[email skipped, no mail transport] Would have sent "${subject}" to ${to}`);
      return;
    }

    try {
      await this.deliver(to, subject, html);
    } catch (err) {
      this.logger.error(`Failed to send team approval email to ${to}`, err instanceof Error ? err.stack : err);
    }
  }

  async sendTeamJoinInvite(params: {
    to: string;
    teamName: string;
    inviterName: string;
    token: string;
  }) {
    const { to, teamName, inviterName, token } = params;
    const registerUrl = `${this.frontendUrl}/invite/${token}`;
    const subject = sanitizeSubject(`${inviterName} הזמין/ה אותך להצטרף לצוות: ${teamName}`);
    const html = `
      <div dir="rtl" style="font-family: sans-serif; text-align: right;">
        <h2>הוזמנת להצטרף לצוות</h2>
        <p>${escapeHtml(inviterName)} הזמין/ה אותך להצטרף לצוות "<strong>${escapeHtml(teamName)}</strong>".</p>
        <p>הרשמ/י דרך הקישור הבא כדי להצטרף לצוות באופן מיידי:</p>
        <p><a href="${escapeHtml(registerUrl)}">הרשמה והצטרפות לצוות</a></p>
      </div>
    `;

    if (!this.canSend) {
      this.logger.warn(`[email skipped, no mail transport] Would have sent "${subject}" to ${to}`);
      return;
    }

    try {
      await this.deliver(to, subject, html);
    } catch (err) {
      this.logger.error(`Failed to send team join invite email to ${to}`, err instanceof Error ? err.stack : err);
    }
  }
}
