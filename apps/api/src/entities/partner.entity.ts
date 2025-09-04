import { CustomerStatus, OnboardingStep } from '@prisma/client';

export interface PartnerData {
  id: number;
  partnerName: string;
  website?: string | null;
  officeLocation?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export class Partner {
  // Properties (all Prisma fields)
  id: number;
  partnerName: string;
  website?: string | null;
  officeLocation?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(data: PartnerData) {
    this.id = data.id;
    this.partnerName = data.partnerName;
    this.website = data.website;
    this.officeLocation = data.officeLocation;
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.createdBy = data.createdBy;
    this.updatedBy = data.updatedBy;
  }

  // Computed properties
  get displayName(): string {
    return this.partnerName;
  }

  get hasWebsite(): boolean {
    return !!this.website;
  }

  get hasOfficeLocation(): boolean {
    return !!this.officeLocation;
  }

  // Business logic methods
  isPartnerActive(): boolean {
    return this.isActive;
  }

  canCreateCustomers(): boolean {
    return this.isActive;
  }

  canAccessCustomerData(): boolean {
    return this.isActive;
  }

  // Validation methods
  validateBeforeSave(): ValidationResult {
    const errors: string[] = [];

    if (!this.partnerName || this.partnerName.trim().length === 0) {
      errors.push('Partner name is required');
    }

    if (this.partnerName && this.partnerName.length > 100) {
      errors.push('Partner name must be less than 100 characters');
    }

    if (this.website && !this.isValidUrl(this.website)) {
      errors.push('Website must be a valid URL');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateForUpdate(): ValidationResult {
    const errors: string[] = [];

    if (!this.id) {
      errors.push('Partner ID is required for updates');
    }

    const baseValidation = this.validateBeforeSave();
    errors.push(...baseValidation.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Helper methods
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Data transformation methods
  toPrismaData(): any {
    return {
      id: this.id,
      partnerName: this.partnerName,
      website: this.website,
      officeLocation: this.officeLocation,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
    };
  }

  static fromPrismaData(data: any): Partner {
    return new Partner({
      id: data.id,
      partnerName: data.partnerName,
      website: data.website,
      officeLocation: data.officeLocation,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    });
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
