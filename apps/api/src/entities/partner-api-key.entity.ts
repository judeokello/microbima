import { ValidationResult } from './partner.entity';
import * as crypto from 'crypto';

export interface PartnerApiKeyData {
  id: number;
  partnerId: number;
  apiKey: string; // SHA-256 hashed
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PartnerApiKey {
  // Properties (all Prisma fields)
  id: number;
  partnerId: number;
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

  isForPartner(partnerId: number): boolean {
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
  toPrismaData(): Record<string, unknown> {
    return {
      id: this.id,
      partnerId: this.partnerId,
      apiKey: this.apiKey,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromPrismaData(data: unknown): PartnerApiKey {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid Prisma data for PartnerApiKey');
    }
    const d = data as Record<string, unknown>;
    return new PartnerApiKey({
      id: d.id as string,
      partnerId: d.partnerId as number,
      apiKey: d.apiKey as string,
      isActive: d.isActive as boolean,
      createdAt: d.createdAt as Date,
      updatedAt: d.updatedAt as Date,
    });
  }

  // Static utility methods
  static hashApiKey(apiKey: string): string {
    // Simple SHA-256 hash (in production, use crypto module)
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  static validateApiKeyFormat(apiKey: string): boolean {

    if (apiKey.length < 16) {
      return false;
    }

    const apiKeyRegex = /^[a-zA-Z0-9_-]+$/;
    return apiKeyRegex.test(apiKey);
  }
}
