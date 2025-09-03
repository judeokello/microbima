export interface PartnerCustomerData {
  id: string;
  partnerId: string;
  customerId: string;
  partnerCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PartnerCustomer {
  // Properties (all Prisma fields)
  id: string;
  partnerId: string;
  customerId: string;
  partnerCustomerId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: PartnerCustomerData) {
    this.id = data.id;
    this.partnerId = data.partnerId;
    this.customerId = data.customerId;
    this.partnerCustomerId = data.partnerCustomerId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Computed properties
  get uniqueKey(): string {
    return `${this.partnerId}:${this.partnerCustomerId}`;
  }

  get isRecentlyCreated(): boolean {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return this.createdAt > oneDayAgo;
  }

  // Business logic methods
  isForPartner(partnerId: string): boolean {
    return this.partnerId === partnerId;
  }

  isForCustomer(customerId: string): boolean {
    return this.customerId === customerId;
  }

  hasPartnerCustomerId(partnerCustomerId: string): boolean {
    return this.partnerCustomerId === partnerCustomerId;
  }

  // Validation methods
  validateBeforeSave(): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!this.partnerId) {
      errors.push('Partner ID is required');
    }

    if (!this.customerId) {
      errors.push('Customer ID is required');
    }

    if (!this.partnerCustomerId) {
      errors.push('Partner customer ID is required');
    }

    // Field validations
    if (this.partnerCustomerId && this.partnerCustomerId.length > 100) {
      errors.push('Partner customer ID must be less than 100 characters');
    }

    if (this.partnerCustomerId && this.partnerCustomerId.trim().length === 0) {
      errors.push('Partner customer ID cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateForUpdate(): ValidationResult {
    const errors: string[] = [];

    if (!this.id) {
      errors.push('Partner customer ID is required for updates');
    }

    const baseValidation = this.validateBeforeSave();
    errors.push(...baseValidation.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateUniqueConstraint(): ValidationResult {
    const errors: string[] = [];

    if (!this.partnerId || !this.partnerCustomerId) {
      errors.push('Partner ID and Partner Customer ID are required for uniqueness validation');
    }

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
      customerId: this.customerId,
      partnerCustomerId: this.partnerCustomerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromPrismaData(data: any): PartnerCustomer {
    return new PartnerCustomer({
      id: data.id,
      partnerId: data.partnerId,
      customerId: data.customerId,
      partnerCustomerId: data.partnerCustomerId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

