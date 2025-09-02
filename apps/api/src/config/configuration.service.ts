import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseConfigurationService, BaseConfigOptions } from '@microbima/common-config';
import { getDatabaseConfig, validateDatabaseConfig, DatabaseConfig } from './database.config';

export interface AppConfig {
  environment: string;
  port: number;
  apiPrefix: string;
  database: DatabaseConfig;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
    enableConsole: boolean;
    enableFile: boolean;
  };
}

@Injectable()
export class ConfigurationService extends BaseConfigurationService implements OnModuleInit {
  private config!: AppConfig;

  protected getAppName(): string {
    return 'microbima-api';
  }

  protected getDefaultPort(): number {
    return 3000;
  }

  protected getDefaultApiPrefix(): string {
    return 'api';
  }

  onModuleInit() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  private loadConfiguration(): AppConfig {
    const baseConfig = this.loadBaseConfiguration();
    
    return {
      ...baseConfig,
      database: getDatabaseConfig(),
      jwt: {
        secret: process.env.JWT_SECRET || this.getDefaultJwtSecret(baseConfig.environment),
        expiresIn: process.env.JWT_EXPIRES_IN || this.getDefaultJwtExpiry(baseConfig.environment),
      },
    };
  }

  private getDefaultJwtSecret(env: string): string {
    if (env === 'production' || env === 'staging') {
      throw new Error('JWT_SECRET is required in staging and production environments');
    }
    return 'dev-secret-key-change-in-production';
  }

  private getDefaultJwtExpiry(env: string): string {
    switch (env) {
      case 'production':
        return '15m'; // Short expiry for production security
      case 'staging':
        return '1h';  // Medium expiry for staging
      default:
        return '24h'; // Long expiry for development
    }
  }

  private validateConfiguration(): void {
    const { database, jwt } = this.config;

    // Validate base configuration
    this.validateBaseConfiguration(this.config);

    // Validate database config
    validateDatabaseConfig(database);

    // Validate JWT config
    if (!jwt.secret) {
      throw new Error('JWT_SECRET is required');
    }

    // Environment-specific validations
    if (this.isRemote()) {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required in remote environments');
      }
    }
  }

  // Public getters for configuration values
  get environment(): string {
    return this.config?.environment || 'development';
  }

  get port(): number {
    return this.config?.port || 3000;
  }

  get apiPrefix(): string {
    return this.config?.apiPrefix || 'api';
  }

  get database(): DatabaseConfig {
    return this.config?.database || getDatabaseConfig();
  }

  get jwt() {
    return this.config?.jwt || {
      secret: 'dev-secret-key-change-in-production',
      expiresIn: '24h'
    };
  }

  get cors() {
    return this.config?.cors || {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    };
  }

  get rateLimit() {
    return this.config?.rateLimit || {
      windowMs: 900000,
      max: 100
    };
  }

  get logging() {
    return this.config?.logging || {
      level: 'debug',
      enableConsole: true,
      enableFile: false
    };
  }

  // Get full config (useful for debugging)
  getFullConfig(): AppConfig {
    return { ...this.config };
  }
}
