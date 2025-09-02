export type Environment = 'development' | 'staging' | 'production' | 'test';

export class EnvironmentConfig {
  static getEnvironment(): Environment {
    return (process.env.NODE_ENV as Environment) || 'development';
  }
  
  static isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }
  
  static isStaging(): boolean {
    return this.getEnvironment() === 'staging';
  }
  
  static isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }
  
  static isTest(): boolean {
    return this.getEnvironment() === 'test';
  }
  
  static isLocal(): boolean {
    return this.isDevelopment() || this.isTest();
  }
  
  static isRemote(): boolean {
    return this.isStaging() || this.isProduction();
  }
}

