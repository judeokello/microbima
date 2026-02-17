import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigurationService } from '../../../config/configuration.service';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class SmtpEmailService implements OnModuleInit {
  private readonly logger = new Logger(SmtpEmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigurationService) {}

  async onModuleInit() {
    const smtpHost = this.config.messaging.smtpHost;
    const smtpPort = this.config.messaging.smtpPort;
    const smtpUsername = this.config.messaging.smtpUsername;
    const smtpPassword = this.config.messaging.smtpPassword;

    if (!smtpHost || !smtpUsername || !smtpPassword) {
      this.logger.warn(
        'SMTP credentials not fully configured. Email sending will fail. ' +
        'Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD in env.'
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: this.config.messaging.smtpSecure,
        auth: {
          user: smtpUsername,
          pass: smtpPassword,
        },
      });

      // Verify connection on startup
      await this.transporter.verify();
      this.logger.log(`✅ SMTP connection verified (host=${smtpHost}, port=${smtpPort})`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize SMTP connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      this.transporter = null;
    }
  }

  /**
   * T031: Send email via SMTP using nodemailer.
   *
   * Supports Gmail SMTP for testing and custom domain SMTP for production.
   *
   * Required env vars:
   * - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
   * - SMTP_PORT: SMTP port (587 for TLS, 465 for SSL)
   * - SMTP_SECURE: true for 465, false for 587
   * - SMTP_USERNAME: Email username (usually full email address)
   * - SMTP_PASSWORD: Email password or app password
   * - SMTP_FROM_EMAIL: From address
   * - SMTP_FROM_NAME: From display name (optional)
   *
   * Gmail Setup:
   * 1. Enable 2FA on your Google account
   * 2. Generate App Password at: https://myaccount.google.com/apppasswords
   * 3. Use app password (not your regular password) in SMTP_PASSWORD
   */
  async sendEmail(params: {
    to: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
  }) {
    if (!this.transporter) {
      throw new Error(
        'SMTP transporter not initialized. Check SMTP configuration in env vars.'
      );
    }

    const fromEmail = this.config.messaging.smtpFromEmail;
    const fromName = this.config.messaging.smtpFromName;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    this.logger.log(
      `Sending email to ${params.to} via SMTP (from=${from}, subject="${params.subject}")`
    );

    try {
      const info = await this.transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        html: params.htmlBody,
        text: params.textBody,
        attachments: params.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      });

      // nodemailer returns messageId (e.g., <random@hostname>)
      const messageId = info.messageId ?? `smtp-${Date.now()}`;

      this.logger.log(
        `Email sent successfully to ${params.to}, messageId=${messageId}, response=${info.response}`
      );

      return { messageId, status: 'sent' };
    } catch (error) {
      this.logger.error(
        `SMTP send failed to ${params.to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }
}
