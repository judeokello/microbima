import { EnvironmentConfig, Environment } from './environment';

export interface BaseConfigOptions {
  port?: number;
  apiPrefix?: string;
  corsOrigins?: string;
  corsCredentials?: boolean;
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  logLevel?: string;
  enableConsoleLogging?: boolean;
  enableFileLogging?: boolean;
}

export abstract class BaseConfigurationService {
  protected abstract getAppName(): string;
  protected abstract getDefaultPort(): number;
  protected abstract getDefaultApiPrefix(): string;

  protected loadBaseConfiguration(options: BaseConfigOptions = {}) {
    const env = EnvironmentConfig.getEnvironment();
    
    return {
      environment: env,
      port: options.port || parseInt(process.env.PORT || this.getDefaultPort().toString()),
      apiPrefix: options.apiPrefix || process.env.API_PREFIX || this.getDefaultApiPrefix(),
      cors: {
        origin: this.parseCorsOrigins(options.corsOrigins || process.env.CORS_ORIGINS),
        credentials: options.corsCredentials ?? (process.env.CORS_CREDENTIALS === 'true'),
      },
      rateLimit: {
        windowMs: options.rateLimitWindowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        max: options.rateLimitMax || parseInt(process.env.RATE_LIMIT_MAX || '100'),
      },
      logging: {
        level: options.logLevel || process.env.LOG_LEVEL || this.getDefaultLogLevel(env),
        enableConsole: options.enableConsoleLogging ?? (process.env.LOG_ENABLE_CONSOLE !== 'false'),
        enableFile: options.enableFileLogging ?? (process.env.LOG_ENABLE_FILE === 'true'),
      },
    };
  }

  protected parseCorsOrigins(origins?: string): string[] {
    if (!origins) {
      return ['http://localhost:3000', 'http://localhost:3001'];
    }
    return origins.split(',').map(origin => origin.trim());
  }

  protected getDefaultLogLevel(env: Environment): string {
    switch (env) {
      case 'production':
        return 'warn';
      case 'staging':
        return 'info';
      default:
        return 'debug';
    }
  }

  protected validateBaseConfiguration(config: any): void {
    // Validate port
    if (config.port < 1 || config.port > 65535) {
      throw new Error(`Invalid port: ${config.port}. Must be between 1 and 65535`);
    }

    // Validate rate limit
    if (config.rateLimit.windowMs <= 0) {
      throw new Error('Rate limit window must be greater than 0');
    }

    if (config.rateLimit.max <= 0) {
      throw new Error('Rate limit max must be greater than 0');
    }
  }

  // Helper methods
  isDevelopment(): boolean {
    return EnvironmentConfig.isDevelopment();
  }

  isStaging(): boolean {
    return EnvironmentConfig.isStaging();
  }

  isProduction(): boolean {
    return EnvironmentConfig.isProduction();
  }

  isLocal(): boolean {
    return EnvironmentConfig.isLocal();
  }

  isRemote(): boolean {
    return EnvironmentConfig.isRemote();
  }
}

