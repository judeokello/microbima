import { ValidationResult } from './partner.entity';

export interface PartnerApiKeyData {
  id: string;
  partnerId: string;
  apiKey: string; // SHA-256 hashed
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PartnerApiKey {
  // Properties (all Prisma fields)
  id: string;
  partnerId: string;
  apiKey: string; // SHA-256 hashed
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: PartnerApiKeyData) {
    this.id = data.id;
    this.partnerId = data.partnerId;
    this.apiKey = data.apiKey;
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Computed properties
  get isRecentlyCreated(): boolean {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return this.createdAt > oneDayAgo;
  }

  // Business logic methods
  isKeyActive(): boolean {
    return this.isActive;
  }

  isForPartner(partnerId: string): boolean {
    return this.partnerId === partnerId;
  }

  // Validation methods
  validateBeforeSave(): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!this.partnerId) {
      errors.push('Partner ID is required');
    }

    if (!this.apiKey) {
      errors.push('API key is required');
    }

    // Field validations
    if (this.apiKey && this.apiKey.length !== 64) {
      errors.push('API key must be SHA-256 hashed (64 characters)');
    }

    if (this.apiKey && !/^[a-fA-F0-9]{64}$/.test(this.apiKey)) {
      errors.push('API key must be a valid SHA-256 hash');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateForUpdate(): ValidationResult {
    const errors: string[] = [];

    if (!this.id) {
      errors.push('Partner API key ID is required for updates');
    }

    const baseValidation = this.validateBeforeSave();
    errors.push(...baseValidation.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Data transformation methods
  toPrismaData(): any {
    return {
      id: this.id,
      partnerId: this.partnerId,
      apiKey: this.apiKey,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromPrismaData(data: any): PartnerApiKey {
    return new PartnerApiKey({
      id: data.id,
      partnerId: data.partnerId,
      apiKey: data.apiKey,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  // Static utility methods
  static hashApiKey(apiKey: string): string {
    // Simple SHA-256 hash (in production, use crypto module)
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  static validateApiKeyFormat(apiKey: string): boolean {
    // Basic validation for API key format (alphanumeric with hyphens/underscores, min 16 chars)
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    if (apiKey.length < 16) {
      return false;
    }

    const apiKeyRegex = /^[a-zA-Z0-9_-]+$/;
    return apiKeyRegex.test(apiKey);
  }
}
