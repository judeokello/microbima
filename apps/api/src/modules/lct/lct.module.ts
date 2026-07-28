import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ConfigurationModule } from '../../config/config.module';
import { SupabaseService } from '../../services/supabase.service';
import { LctSyncService } from './lct-sync.service';
import { LctExportService } from './lct-export.service';
import { LctStorageService } from './lct-storage.service';
import { InternalLctExportsController } from '../../controllers/internal/lct-exports.controller';

/**
 * LCT providers are also registered on AppModule so PolicyService ↔ LctSyncService
 * forwardRef circular DI resolves in the same Nest module context.
 * This module exists for encapsulation / future extraction.
 */
@Module({
  imports: [PrismaModule, MessagingModule, ConfigurationModule],
  controllers: [InternalLctExportsController],
  providers: [SupabaseService, LctStorageService, LctSyncService, LctExportService],
  exports: [LctSyncService, LctExportService, LctStorageService],
})
export class LctModule {}
