import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigurationService } from './configuration.service';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        // App-specific environment files
        `apps/api/.env.${process.env.NODE_ENV || 'development'}`,
        'apps/api/.env',
        // Root environment files
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
      // In production, ignore .env files and rely on environment variables
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      // Cache environment variables
      cache: true,
      // Expand variables (e.g., ${VAR_NAME})
      expandVariables: true,
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}

