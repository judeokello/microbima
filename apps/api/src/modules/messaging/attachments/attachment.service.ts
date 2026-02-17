import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../../../config/configuration.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * T032: Service for managing email attachments.
 *
 * Responsibilities:
 * - Upload attachments to Supabase Storage (prod/staging) or local filesystem (dev)
 * - Generate presigned URLs for internal admin download (Supabase) or direct file paths (local)
 * - Handle attachment expiry (90 days from createdAt)
 * - Implement degraded storage error handling
 *
 * Storage Rules:
 * - Private bucket: messaging-attachments (Supabase) or local storage/messaging-attachments/ (dev)
 * - Paths: {deliveryId}/{attachmentId}.pdf
 * - Max size: 5 MB per file
 * - Retention: 90 days
 * - Deletion: Physical removal after expiry
 *
 * Storage Strategy:
 * - NODE_ENV === 'development': Local filesystem storage (mimics mpesa_statements pattern)
 * - NODE_ENV === 'staging' | 'production': Supabase Storage
 */
@Injectable()
export class MessagingAttachmentService {
  private readonly logger = new Logger(MessagingAttachmentService.name);
  private supabase: SupabaseClient | null = null;
  private isLocalMode: boolean;
  private localStoragePath: string;

  constructor(private readonly config: ConfigurationService) {
    this.isLocalMode = process.env.NODE_ENV === 'development';

    if (this.isLocalMode) {
      // Local filesystem storage (dev only)
      this.localStoragePath = path.join(
        process.cwd(),
        'storage',
        'messaging-attachments'
      );
      this.logger.log(
        `📁 Using local filesystem storage for attachments (path: ${this.localStoragePath})`
      );
    } else {
      // Supabase Storage (staging/production)
      const supabaseUrl = this.config.supabaseUrl;
      const supabaseServiceKey = this.config.supabaseServiceRoleKey;

      if (!supabaseUrl || !supabaseServiceKey) {
        this.logger.warn(
          'Supabase credentials missing. Attachment storage will fail in non-dev environment.'
        );
      } else {
        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
        this.logger.log('☁️  Using Supabase Storage for attachments');
      }
    }
  }

  /**
   * Upload attachment to storage (local or Supabase based on NODE_ENV).
   *
   * @param deliveryId - Delivery record ID
   * @param attachmentId - Attachment record ID (UUID)
   * @param fileName - File name (e.g., "member-card.pdf")
   * @param fileBuffer - PDF file contents
   * @returns Storage path/key
   * @throws Error if upload fails
   */
  async uploadAttachment(
    deliveryId: string,
    attachmentId: string,
    fileName: string,
    fileBuffer: Buffer
  ): Promise<string> {
    const storagePath = `${deliveryId}/${attachmentId}.pdf`;

    if (this.isLocalMode) {
      // Local filesystem storage
      const fullPath = path.join(this.localStoragePath, storagePath);
      const dirPath = path.dirname(fullPath);

      try {
        // Ensure directory exists
        await fs.mkdir(dirPath, { recursive: true });

        // Write file
        await fs.writeFile(fullPath, fileBuffer);

        this.logger.log(
          `✅ Uploaded attachment locally: ${storagePath} (size=${fileBuffer.length} bytes)`
        );

        return storagePath;
      } catch (error) {
        this.logger.error(
          `Failed to upload attachment locally: ${storagePath}`,
          error instanceof Error ? error.stack : undefined
        );
        throw new Error(
          `Local attachment upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Supabase Storage
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const bucket = this.config.messaging.supabaseMessagingAttachmentsBucket;

      try {
        const { error } = await this.supabase.storage
          .from(bucket)
          .upload(storagePath, fileBuffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (error) {
          throw error;
        }

        this.logger.log(
          `✅ Uploaded attachment to Supabase: ${storagePath} (bucket=${bucket}, size=${fileBuffer.length} bytes)`
        );

        return storagePath;
      } catch (error) {
        this.logger.error(
          `Failed to upload attachment to Supabase: ${storagePath}`,
          error instanceof Error ? error.stack : undefined
        );
        throw new Error(
          `Supabase attachment upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Get attachment file buffer for download or resend.
   *
   * @param storagePath - Storage path (e.g., "delivery-id/attachment-id.pdf")
   * @returns File buffer and content type
   * @throws Error if file not found or download fails
   */
  async getAttachment(storagePath: string): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    if (this.isLocalMode) {
      // Local filesystem storage
      const fullPath = path.join(this.localStoragePath, storagePath);

      try {
        const buffer = await fs.readFile(fullPath);

        this.logger.log(
          `✅ Retrieved attachment from local storage: ${storagePath} (size=${buffer.length} bytes)`
        );

        return {
          buffer,
          contentType: 'application/pdf',
        };
      } catch (error) {
        this.logger.error(
          `Failed to retrieve attachment from local storage: ${storagePath}`,
          error instanceof Error ? error.stack : undefined
        );
        throw new Error(
          `Local attachment not found: ${storagePath}`
        );
      }
    } else {
      // Supabase Storage
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const bucket = this.config.messaging.supabaseMessagingAttachmentsBucket;

      try {
        const { data, error } = await this.supabase.storage
          .from(bucket)
          .download(storagePath);

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('No data returned from Supabase');
        }

        const buffer = Buffer.from(await data.arrayBuffer());

        this.logger.log(
          `✅ Retrieved attachment from Supabase: ${storagePath} (bucket=${bucket}, size=${buffer.length} bytes)`
        );

        return {
          buffer,
          contentType: 'application/pdf',
        };
      } catch (error) {
        this.logger.error(
          `Failed to retrieve attachment from Supabase: ${storagePath}`,
          error instanceof Error ? error.stack : undefined
        );
        throw new Error(
          `Supabase attachment not found: ${storagePath}`
        );
      }
    }
  }

  /**
   * Generate presigned URL for attachment download (Supabase only).
   * For local mode, returns a placeholder message.
   *
   * @param storagePath - Storage path
   * @param expiresIn - URL expiry in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL or local path message
   */
  async getPresignedUrl(
    storagePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    if (this.isLocalMode) {
      // Local mode: return a placeholder (admin would use download endpoint)
      return `local://${storagePath}`;
    } else {
      // Supabase Storage: generate presigned URL
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const bucket = this.config.messaging.supabaseMessagingAttachmentsBucket;

      try {
        const { data, error } = await this.supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, expiresIn);

        if (error || !data) {
          throw error || new Error('No signed URL returned');
        }

        this.logger.log(
          `✅ Generated presigned URL for: ${storagePath} (expires in ${expiresIn}s)`
        );

        return data.signedUrl;
      } catch (error) {
        this.logger.error(
          `Failed to generate presigned URL: ${storagePath}`,
          error instanceof Error ? error.stack : undefined
        );
        throw new Error(
          `Presigned URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Delete attachment from storage (local or Supabase).
   *
   * @param storagePath - Storage path
   * @throws Error if deletion fails
   */
  async deleteAttachment(storagePath: string): Promise<void> {
    if (this.isLocalMode) {
      // Local filesystem storage
      const fullPath = path.join(this.localStoragePath, storagePath);

      try {
        await fs.unlink(fullPath);

        this.logger.log(`🗑️  Deleted attachment from local storage: ${storagePath}`);
      } catch (error) {
        this.logger.error(
          `Failed to delete attachment from local storage: ${storagePath}`,
          error instanceof Error ? error.stack : undefined
        );
        throw new Error(
          `Local attachment deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Supabase Storage
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const bucket = this.config.messaging.supabaseMessagingAttachmentsBucket;

      try {
        const { error } = await this.supabase.storage
          .from(bucket)
          .remove([storagePath]);

        if (error) {
          throw error;
        }

        this.logger.log(
          `🗑️  Deleted attachment from Supabase: ${storagePath} (bucket=${bucket})`
        );
      } catch (error) {
        this.logger.error(
          `Failed to delete attachment from Supabase: ${storagePath}`,
          error instanceof Error ? error.stack : undefined
        );
        throw new Error(
          `Supabase attachment deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Compute expiry date for an attachment given retention in months.
   * 0 or negative retention = never expires (returns far-future date).
   *
   * @param createdAt - Attachment creation timestamp
   * @param retentionMonths - From system settings. 0 or negative = never expires.
   * @returns Expiry date (or 9999-12-31 if never expires)
   */
  getExpiresAt(createdAt: Date, retentionMonths: number): Date {
    if (retentionMonths <= 0) {
      return new Date('9999-12-31T23:59:59.999Z');
    }
    const expiry = new Date(createdAt);
    expiry.setUTCMonth(expiry.getUTCMonth() + retentionMonths);
    return expiry;
  }

  /**
   * Check if attachment has expired based on retention (months).
   * 0 or negative retentionMonths = never expires.
   *
   * @param createdAt - Attachment creation timestamp
   * @param retentionMonths - From system settings (messagingAttachmentRetentionMonths).
   * @returns true if expired, false otherwise
   */
  isExpired(createdAt: Date, retentionMonths: number): boolean {
    if (retentionMonths <= 0) return false;
    const expiry = this.getExpiresAt(createdAt, retentionMonths);
    return new Date() > expiry;
  }
}
