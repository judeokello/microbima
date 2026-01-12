import { Gender, IdType } from '@prisma/client';

export interface BeneficiaryData {
  id: string;
  customerId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  email?: string | null;
  phoneNumber?: string | null;
  idType?: IdType | null;
  idNumber?: string | null;
  relationship?: string | null;
  relationshipDescription?: string | null;
  percentage?: number | null;
  isVerified: boolean;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  createdByPartnerId: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Beneficiary {
  // Properties (all Prisma fields)
  id: string;
  customerId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  email?: string | null;
  phoneNumber?: string | null;
  idType?: IdType | null;
  idNumber?: string | null;
  relationship?: string | null;
  relationshipDescription?: string | null;
  percentage?: number | null;
  isVerified: boolean;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  createdByPartnerId: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: BeneficiaryData) {
    this.id = data.id;
    this.customerId = data.customerId;
    this.firstName = data.firstName;
    this.middleName = data.middleName;
    this.lastName = data.lastName;
    this.dateOfBirth = data.dateOfBirth;
    this.gender = data.gender;
    this.email = data.email;
    this.phoneNumber = data.phoneNumber;
    this.idType = data.idType ?? null;
    this.idNumber = data.idNumber ?? null;
    this.relationship = data.relationship;
    this.relationshipDescription = data.relationshipDescription;
    this.percentage = data.percentage;
    this.isVerified = data.isVerified;
    this.verifiedAt = data.verifiedAt;
    this.verifiedBy = data.verifiedBy;
    this.createdByPartnerId = data.createdByPartnerId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Computed properties
  get fullName(): string {
    const middleName = this.middleName ? ` ${this.middleName}` : '';
    return `${this.firstName}${middleName} ${this.lastName}`;
  }

  get age(): number | null {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  get isAdult(): boolean {
    const beneficiaryAge = this.age;
    return beneficiaryAge !== null && beneficiaryAge >= 18;
  }

  get isMinor(): boolean {
    const beneficiaryAge = this.age;
    return beneficiaryAge !== null && beneficiaryAge < 18;
  }

  get hasValidPercentage(): boolean {
    return this.percentage !== null && this.percentage !== undefined && this.percentage >= 1 && this.percentage <= 100;
  }

  get displayPercentage(): string {
    return this.percentage ? `${this.percentage}%` : 'Not specified';
  }

  // Business logic methods
  isEligibleForBenefits(): boolean {
    return this.hasValidPercentage && this.isAdult;
  }

  canReceiveBenefits(): boolean {
    return this.isEligibleForBenefits();
  }

  getBenefitAmount(totalAmount: number): number {
    if (!this.hasValidPercentage) return 0;
    return (totalAmount * this.percentage!) / 100;
  }

  // Validation methods
  validateBeforeSave(): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!this.customerId) {
      errors.push('Customer ID is required');
    }

    if (!this.firstName || this.firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    const hasIdNumber = !!(this.idNumber && this.idNumber.trim().length > 0);
    const hasIdType = !!this.idType;

    if (hasIdNumber !== hasIdType) {
      errors.push('ID number and ID type must both be provided together');
    }

    if (!this.createdByPartnerId) {
      errors.push('Created by partner ID is required');
    }

    // Field validations
    if (this.firstName && this.firstName.length > 50) {
      errors.push('First name must be less than 50 characters');
    }

    if (this.middleName && this.middleName.length > 50) {
      errors.push('Middle name must be less than 50 characters');
    }

    if (this.lastName && this.lastName.length > 50) {
      errors.push('Last name must be less than 50 characters');
    }

    if (this.idNumber && this.idNumber.length > 50) {
      errors.push('ID number must be less than 50 characters');
    }

    if (this.relationship && this.relationship.length > 100) {
      errors.push('Relationship description must be less than 100 characters');
    }

    if (this.dateOfBirth && this.dateOfBirth > new Date()) {
      errors.push('Date of birth cannot be in the future');
    }

    if (this.dateOfBirth && this.age !== null && this.age > 120) {
      errors.push('Age cannot be greater than 120 years');
    }

    if (this.percentage !== null && this.percentage !== undefined && (this.percentage < 1 || this.percentage > 100)) {
      errors.push('Percentage must be between 1 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateForUpdate(): ValidationResult {
    const errors: string[] = [];

    if (!this.id) {
      errors.push('Beneficiary ID is required for updates');
    }

    const baseValidation = this.validateBeforeSave();
    errors.push(...baseValidation.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validatePercentageWithOthers(totalPercentage: number): ValidationResult {
    const errors: string[] = [];

    if (this.percentage !== null && this.percentage !== undefined) {
      const newTotal = totalPercentage + this.percentage;
      if (newTotal > 100) {
        errors.push(`Total percentage would exceed 100% (current: ${totalPercentage}%, adding: ${this.percentage}%)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Data transformation methods
  toPrismaData(): Record<string, unknown> {
    return {
      id: this.id,
      customerId: this.customerId,
      firstName: this.firstName,
      middleName: this.middleName,
      lastName: this.lastName,
      dateOfBirth: this.dateOfBirth,
      gender: this.gender,
      idType: this.idType ?? null,
      idNumber: this.idNumber ?? null,
      relationship: this.relationship,
      percentage: this.percentage,
      isVerified: this.isVerified,
      verifiedAt: this.verifiedAt,
      verifiedBy: this.verifiedBy,
      createdByPartnerId: this.createdByPartnerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromPrismaData(data: unknown): Beneficiary {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid Prisma data for Beneficiary');
    }
    const d = data as Record<string, unknown>;
    return new Beneficiary({
      id: d.id as string,
      customerId: d.customerId as string,
      firstName: d.firstName as string,
      middleName: d.middleName as string | null | undefined,
      lastName: d.lastName as string,
      dateOfBirth: d.dateOfBirth as Date | null | undefined,
      gender: d.gender as Gender | null | undefined,
      email: d.email as string | null | undefined,
      phoneNumber: d.phoneNumber as string | null | undefined,
      idType: (d.idType ?? null) as IdType | null,
      idNumber: (d.idNumber ?? null) as string | null,
      relationship: d.relationship as string | null | undefined,
      relationshipDescription: d.relationshipDescription as string | null | undefined,
      percentage: d.percentage as number | null | undefined,
      isVerified: d.isVerified as boolean,
      verifiedAt: d.verifiedAt as Date | null | undefined,
      verifiedBy: d.verifiedBy as string | null | undefined,
      createdByPartnerId: d.createdByPartnerId as number,
      createdAt: d.createdAt as Date,
      updatedAt: d.updatedAt as Date,
    });
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
