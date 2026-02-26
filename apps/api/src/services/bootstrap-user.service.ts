import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service to identify the bootstrap (first) user in the system.
 * The bootstrap user is the very first user created in auth.users.
 */
@Injectable()
export class BootstrapUserService {
  private readonly logger = new Logger(BootstrapUserService.name);
  private cachedBootstrapUserId: string | null | undefined = undefined;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the bootstrap user ID (first user by created_at in auth.users).
   * Results are cached for the process lifetime.
   */
  async getBootstrapUserId(): Promise<string | null> {
    if (this.cachedBootstrapUserId !== undefined) {
      return this.cachedBootstrapUserId;
    }

    try {
      const result = await this.prisma.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1`;
      const id = result[0]?.id ?? null;
      this.cachedBootstrapUserId = id;
      return id;
    } catch (err) {
      this.logger.warn(
        `Failed to get bootstrap user ID: ${err instanceof Error ? err.message : String(err)}`
      );
      this.cachedBootstrapUserId = null;
      return null;
    }
  }

  /**
   * Check if the given user ID is the bootstrap user.
   */
  async isBootstrapUser(userId: string): Promise<boolean> {
    const bootstrapId = await this.getBootstrapUserId();
    return bootstrapId !== null && bootstrapId === userId;
  }
}
