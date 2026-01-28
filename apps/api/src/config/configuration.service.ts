import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseConfigurationService } from '@microbima/common-config';
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
  sentry: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
    profilesSampleRate: number;
    enabled: boolean;
  };
  mpesa: {
    consumerKey: string;
    consumerSecret: string;
    businessShortCode: string;
    passkey: string;
    environment: 'sandbox' | 'production';
    baseUrl: string;
    stkPushCallbackUrl: string;
    ipnConfirmationUrl: string;
    allowedIpRanges: string[];
    stkPushTimeoutMinutes: number;
    stkPushExpirationCheckIntervalMinutes: number;
  };
}

@Injectable()
export class ConfigurationService extends BaseConfigurationService implements OnModuleInit {
  private config!: AppConfig;

  protected getAppName(): string {
    return 'microbima-api';
  }

  protected getDefaultPort(): number {
    return parseInt(process.env.PORT ?? '3001', 10);
  }

  protected getDefaultApiPrefix(): string {
    return process.env.API_PREFIX ?? 'api';
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
        secret: process.env.JWT_SECRET ?? this.getDefaultJwtSecret(baseConfig.environment),
        expiresIn: process.env.JWT_EXPIRES_IN ?? this.getDefaultJwtExpiry(baseConfig.environment),
      },
      sentry: {
        dsn: process.env.SENTRY_DSN ?? '',
        environment: process.env.SENTRY_ENVIRONMENT ?? baseConfig.environment,
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '1.0'),
        profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '1.0'),
        enabled: !!process.env.SENTRY_DSN,
      },
      mpesa: {
        consumerKey: process.env.MPESA_CONSUMER_KEY ?? '',
        consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? '',
        businessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE ?? '',
        // Strip newlines and trim whitespace from passkey (common issue when copying from M-Pesa portal)
        passkey: (process.env.MPESA_PASSKEY ?? '').replace(/\r?\n/g, '').trim(),
        environment: (process.env.MPESA_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production',
        baseUrl: (process.env.MPESA_BASE_URL?.trim() || undefined) ?? this.getDefaultMpesaBaseUrl(process.env.MPESA_ENVIRONMENT ?? 'sandbox'),
        stkPushCallbackUrl: process.env.MPESA_STK_PUSH_CALLBACK_URL ?? '',
        ipnConfirmationUrl: process.env.MPESA_IPN_CONFIRMATION_URL ?? '',
        allowedIpRanges: process.env.MPESA_ALLOWED_IP_RANGES?.split(',').map(range => range.trim()).filter(range => range.length > 0) ?? [],
        stkPushTimeoutMinutes: parseInt(process.env.MPESA_STK_PUSH_TIMEOUT_MINUTES ?? '5', 10),
        stkPushExpirationCheckIntervalMinutes: parseInt(process.env.MPESA_STK_PUSH_EXPIRATION_CHECK_INTERVAL_MINUTES ?? '2', 10),
      },
    };
  }

  private getDefaultMpesaBaseUrl(environment: string): string {
    return environment === 'production'
      ? 'https://api.safaricom.co.ke/mpesa'
      : 'https://sandbox.safaricom.co.ke/mpesa';
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
    const { database, jwt, mpesa } = this.config;

    // Validate base configuration
    this.validateBaseConfiguration(this.config);

    // Validate database config
    validateDatabaseConfig(database);

    // Validate JWT config
    if (!jwt.secret) {
      throw new Error('JWT_SECRET is required');
    }

    // Validate M-Pesa config
    if (!mpesa.consumerKey) {
      throw new Error('MPESA_CONSUMER_KEY is required');
    }
    if (!mpesa.consumerSecret) {
      throw new Error('MPESA_CONSUMER_SECRET is required');
    }
    if (!mpesa.businessShortCode) {
      throw new Error('MPESA_BUSINESS_SHORT_CODE is required');
    }
    if (!mpesa.passkey) {
      throw new Error('MPESA_PASSKEY is required');
    }
    if (!mpesa.stkPushCallbackUrl) {
      throw new Error('MPESA_STK_PUSH_CALLBACK_URL is required');
    }
    if (!mpesa.ipnConfirmationUrl) {
      throw new Error('MPESA_IPN_CONFIRMATION_URL is required');
    }

    // Validate URL formats (HTTPS, valid domain)
    this.validateUrl(mpesa.stkPushCallbackUrl, 'MPESA_STK_PUSH_CALLBACK_URL');
    this.validateUrl(mpesa.ipnConfirmationUrl, 'MPESA_IPN_CONFIRMATION_URL');
    this.validateUrl(mpesa.baseUrl, 'MPESA_BASE_URL');

    // Environment-specific validations
    if (this.isRemote()) {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required in remote environments');
      }
    }
  }

  private validateUrl(url: string, envVarName: string): void {
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'https:') {
        throw new Error(`${envVarName} must use HTTPS protocol`);
      }
      if (!urlObj.hostname || urlObj.hostname.length === 0) {
        throw new Error(`${envVarName} must have a valid domain`);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`${envVarName} must be a valid URL`);
      }
      throw error;
    }
  }

  // Public getters for configuration values
  get environment(): string {
    return this.config?.environment ?? 'development';
  }

  get port(): number {
    // Always read from environment variable to ensure we get the latest value
    const raw = process.env.PORT ?? '3001';
    let port = parseInt(raw, 10);
    // Fly internal-api uses internal_port 3001; if PORT was mistakenly set to 3000 (e.g. by another app's config), fix it to avoid proxy mismatch
    if (this.config?.environment === 'production' && port === 3000 && process.env.FLY_APP_NAME) {
      console.warn('[ConfigurationService] PORT=3000 detected on Fly production; internal_api expects 3001. Using 3001 to match fly.toml internal_port.');
      port = 3001;
    }
    return port;
  }

  get apiPrefix(): string {
    return this.config?.apiPrefix ?? 'api';
  }

  get database(): DatabaseConfig {
    return this.config?.database ?? getDatabaseConfig();
  }

  get jwt() {
    return this.config?.jwt ?? {
      secret: 'dev-secret-key-change-in-production',
      expiresIn: '24h'
    };
  }

  get cors() {
    return this.config?.cors ?? {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    };
  }

  get rateLimit() {
    return this.config?.rateLimit ?? {
      windowMs: 900000,
      max: 100
    };
  }

  get logging() {
    return this.config?.logging ?? {
      level: 'debug',
      enableConsole: true,
      enableFile: false
    };
  }

  get sentry() {
    return this.config?.sentry ?? {
      dsn: '',
      environment: 'development',
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      enabled: false,
    };
  }

  get mpesa() {
    return this.config?.mpesa ?? {
      consumerKey: '',
      consumerSecret: '',
      businessShortCode: '',
      passkey: '',
      environment: 'sandbox',
      baseUrl: 'https://sandbox.safaricom.co.ke/mpesa',
      stkPushCallbackUrl: '',
      ipnConfirmationUrl: '',
      allowedIpRanges: [],
      stkPushTimeoutMinutes: 5,
      stkPushExpirationCheckIntervalMinutes: 2,
    };
  }

  // Get full config (useful for debugging)
  getFullConfig(): AppConfig {
    return { ...this.config };
  }
}
