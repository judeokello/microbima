import { EnvironmentConfig } from '@microbima/common-config';

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  ssl: boolean;
  timeout: number;
  maxConnections: number;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  const env = EnvironmentConfig.getEnvironment();

  switch (env) {
    case 'staging':
      return {
        url: process.env.DATABASE_URL!,
        poolSize: 10,
        ssl: true,
        timeout: 30000,
        maxConnections: 20
      };
    case 'production':
      return {
        url: process.env.DATABASE_URL!,
        poolSize: 20,
        ssl: true,
        timeout: 60000,
        maxConnections: 50
      };
    default: // development
      return {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/microbima_dev',
        poolSize: 5,
        ssl: false,
        timeout: 10000,
        maxConnections: 10
      };
  }
};

export const validateDatabaseConfig = (config: DatabaseConfig): void => {
  if (!config.url) {
    throw new Error('DATABASE_URL is required');
  }

  if (config.poolSize <= 0) {
    throw new Error('Database pool size must be greater than 0');
  }

  if (config.timeout <= 0) {
    throw new Error('Database timeout must be greater than 0');
  }
};
