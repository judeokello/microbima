import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigurationService } from '../../config/configuration.service';
import { SupabaseService } from '../../services/supabase.service';

@Injectable()
export class LctStorageService {
  private readonly logger = new Logger(LctStorageService.name);
  private readonly isLocalMode: boolean;
  private readonly localStoragePath: string;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigurationService,
    private readonly supabaseService: SupabaseService
  ) {
    this.isLocalMode = process.env.NODE_ENV === 'development';
    this.localStoragePath = path.join(process.cwd(), 'storage', 'lct_customer_exports');
    this.bucket = this.config.messaging.supabaseLctCustomerExportsBucket;
  }

  getBucketName(): string {
    return this.isLocalMode ? 'local' : this.bucket;
  }

  /** Relative path: {batchId}/{filename} */
  buildStoragePath(batchId: string, filename: string): string {
    return `${batchId}/${filename}`;
  }

  async upload(storagePath: string, content: Buffer): Promise<void> {
    if (this.isLocalMode) {
      const fullPath = path.join(this.localStoragePath, storagePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
      this.logger.log(`Uploaded LCT CSV locally: ${storagePath}`);
      return;
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.storage.from(this.bucket).upload(storagePath, content, {
      contentType: 'text/csv',
      upsert: false,
    });
    if (error) {
      throw new Error(`Failed to upload LCT CSV: ${error.message}`);
    }
    this.logger.log(`Uploaded LCT CSV to Supabase: ${storagePath}`);
  }

  async download(storagePath: string): Promise<Buffer> {
    if (this.isLocalMode) {
      const fullPath = path.join(this.localStoragePath, storagePath);
      return fs.readFile(fullPath);
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.storage.from(this.bucket).download(storagePath);
    if (error || !data) {
      throw new Error(`Failed to download LCT CSV: ${error?.message ?? 'not found'}`);
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }
}
