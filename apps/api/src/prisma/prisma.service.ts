import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigurationService } from '../config/configuration.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private static instance: PrismaService;

  constructor(private configService: ConfigurationService) {
    const dbConfig = configService.database;

    super({
      log: ['error', 'warn'],
      datasources: {
        db: {
          url: dbConfig.url,
        },
      },
    });

    // Ensure singleton pattern
    if (PrismaService.instance) {
      return PrismaService.instance;
    }
    PrismaService.instance = this;
  }

  async onModuleInit() {
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Attempting to connect to database (attempt ${attempt}/${maxRetries})...`);
        await this.$connect();
        this.logger.log('✅ Database connected successfully');
        return; // Success, exit retry loop
      } catch (error) {
        this.logger.error(
          `❌ Failed to connect to database (attempt ${attempt}/${maxRetries})`,
          error instanceof Error ? error.message : String(error)
        );

        if (error instanceof Error && error.stack) {
          this.logger.error('Stack trace:', error.stack);
        }

        // If this is the last attempt, log and rethrow
        if (attempt === maxRetries) {
          this.logger.error('❌ CRITICAL: All database connection attempts failed. Application will exit.');
          // Don't throw - let NestJS handle it, but log extensively
          // The error will be caught by NestJS lifecycle hooks
          throw new Error(
            `Failed to connect to database after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Wait before retrying
        this.logger.log(`Waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('✅ Database disconnected successfully');
    } catch (error) {
      this.logger.error('❌ Error disconnecting from database', error);
    }
  }

  /**
   * Health check method to verify database connectivity
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get database connection info
   */
  async getConnectionInfo() {
    try {
      const result = await this.$queryRaw`
        SELECT 
          current_database() as database,
          current_user as user,
          inet_server_addr() as host,
          inet_server_port() as port,
          version() as version
      `;
      return result;
    } catch (error) {
      this.logger.error('Failed to get connection info', error);
      throw error;
    }
  }

  /**
   * Clean up method for testing
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'test') {
      const tablenames = await this.$queryRaw<
        Array<{ tablename: string }>
      >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

      const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');

      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
        this.logger.log('✅ Test database cleaned');
      } catch (error) {
        this.logger.error('❌ Failed to clean test database', error);
        throw error;
      }
    } else {
      this.logger.warn('⚠️ Database cleanup only allowed in test environment');
    }
  }
}
