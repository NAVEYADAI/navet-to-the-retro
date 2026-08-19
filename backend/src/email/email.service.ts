import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly fromAddress = process.env.EMAIL_FROM || 'Retro App <onboarding@resend.dev>';
  private readonly frontendUrl = process.env.FRONTEND_URL || 'https://navet-to-retro-frontend.fly.dev';

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.client = apiKey ? new Resend(apiKey) : null;
    if (!this.client) {
      this.logger.warn('RESEND_API_KEY is not set — team approval emails will be logged but not sent.');
    }
  }

  async sendTeamApprovalRequest(params: {
    to: string;
    teamName: string;
    creatorName: string;
    mainOffice?: string | null;
  }) {
    const { to, teamName, creatorName, mainOffice } = params;
    const subject = `בקשת אישור להקמת צוות: ${teamName}`;
    const html = `
      <div dir="rtl" style="font-family: sans-serif; text-align: right;">
        <h2>בקשה לאישור צוות חדש</h2>
        <p>${creatorName} ביקש/ה להקים את הצוות "<strong>${teamName}</strong>"${mainOffice ? ` (${mainOffice})` : ''} ומינה/תה אותך כמאשר/ת.</p>
        <p>הצוות יהפוך לפעיל רק לאחר שתאשר/י אותו באפליקציה.</p>
        <p><a href="${this.frontendUrl}">פתח/י את האפליקציה כדי לאשר או לדחות</a></p>
      </div>
    `;

    if (!this.client) {
      this.logger.warn(`[email skipped, no API key] Would have sent "${subject}" to ${to}`);
      return;
    }

    try {
      await this.client.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html
      });
    } catch (err) {
      this.logger.error(`Failed to send team approval email to ${to}`, err instanceof Error ? err.stack : err);
    }
  }
}
