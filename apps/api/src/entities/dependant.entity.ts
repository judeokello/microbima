import { Gender, DependantRelationship, IdType } from '@prisma/client';

export interface DependantData {
  id: string;
  customerId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  idType?: IdType | null;
  idNumber?: string | null;
  relationship: DependantRelationship;
  isVerified: boolean;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  verificationRequired: boolean;
  createdByPartnerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Dependant {
  // Properties (all Prisma fields)
  id: string;
  customerId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  idType?: IdType | null;
  idNumber?: string | null;
  relationship: DependantRelationship;
  isVerified: boolean;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  verificationRequired: boolean;
  createdByPartnerId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: DependantData) {
    this.id = data.id;
    this.customerId = data.customerId;
    this.firstName = data.firstName;
    this.middleName = data.middleName;
    this.lastName = data.lastName;
    this.dateOfBirth = data.dateOfBirth;
    this.gender = data.gender;
    this.idType = data.idType;
    this.idNumber = data.idNumber;
    this.relationship = data.relationship;
    this.isVerified = data.isVerified;
    this.verifiedAt = data.verifiedAt;
    this.verifiedBy = data.verifiedBy;
    this.verificationRequired = data.verificationRequired;
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
    const dependentAge = this.age;
    return dependentAge !== null && dependentAge >= 18;
  }

  get isMinor(): boolean {
    const dependentAge = this.age;
    return dependentAge !== null && dependentAge < 18;
  }

  get isSpouse(): boolean {
    return this.relationship === DependantRelationship.SPOUSE;
  }

  get isChild(): boolean {
    return this.relationship === DependantRelationship.CHILD;
  }

  get isParent(): boolean {
    return this.relationship === DependantRelationship.PARENT;
  }

  get isSibling(): boolean {
    return this.relationship === DependantRelationship.SIBLING;
  }

  get relationshipDisplayName(): string {
    switch (this.relationship) {
      case DependantRelationship.SPOUSE:
        return 'Spouse';
      case DependantRelationship.CHILD:
        return 'Child';
      case DependantRelationship.PARENT:
        return 'Parent';
      case DependantRelationship.SIBLING:
        return 'Sibling';
      case DependantRelationship.FRIEND:
        return 'Friend';
      case DependantRelationship.OTHER:
        return 'Other';
      default:
        return 'Unknown';
    }
  }

  // Business logic methods
  isEligibleForCoverage(): boolean {
    return this.age !== null && this.age >= 0 && this.age <= 65;
  }

  canBeBeneficiary(): boolean {
    return this.isAdult;
  }

  isEligibleForSpouseCoverage(): boolean {
    return this.isSpouse && this.isEligibleForCoverage();
  }

  isEligibleForChildCoverage(): boolean {
    return this.isChild && this.isEligibleForCoverage();
  }

  isEligibleForParentCoverage(): boolean {
    return this.isParent && this.isEligibleForCoverage();
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

    if (!this.createdByPartnerId) {
      errors.push('Created by partner ID is required');
    }

    // Field validations
    if (this.firstName && this.firstName.length > 50) {
      errors.push('First name must be less than 50 characters');
    }

    if (this.lastName && this.lastName.length > 50) {
      errors.push('Last name must be less than 50 characters');
    }

    if (this.dateOfBirth && this.dateOfBirth > new Date()) {
      errors.push('Date of birth cannot be in the future');
    }

    if (this.dateOfBirth && this.age !== null && this.age > 120) {
      errors.push('Age cannot be greater than 120 years');
    }

    // Business rule validations
    // Note: isBeneficiary field removed - beneficiaries are now separate entities

    if (this.isSpouse && this.age !== null && this.age < 18) {
      errors.push('Spouse must be at least 18 years old');
    }

    // Validate child age (1 day to 24 years)
    if (this.relationship === DependantRelationship.CHILD && this.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(this.dateOfBirth);
      const daysOld = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOld < 1) {
        errors.push('Child age must be at least 1 day old');
      }

      if (this.age !== null && this.age >= 25) {
        errors.push('Child age must be less than 25 years old');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateForUpdate(): ValidationResult {
    const errors: string[] = [];

    if (!this.id) {
      errors.push('Dependant ID is required for updates');
    }

    const baseValidation = this.validateBeforeSave();
    errors.push(...baseValidation.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateRelationshipWithCustomer(customerAge: number | null): ValidationResult {
    const errors: string[] = [];

    if (this.isChild && customerAge !== null && this.age !== null) {
      if (this.age >= customerAge) {
        errors.push('Child cannot be older than or same age as the customer');
      }
    }

    if (this.isParent && customerAge !== null && this.age !== null) {
      if (this.age <= customerAge) {
        errors.push('Parent cannot be younger than or same age as the customer');
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
      idType: this.idType,
      idNumber: this.idNumber,
      relationship: this.relationship,
      isVerified: this.isVerified,
      verifiedAt: this.verifiedAt,
      verifiedBy: this.verifiedBy,
      verificationRequired: this.verificationRequired,
      createdByPartnerId: this.createdByPartnerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromPrismaData(data: unknown): Dependant {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid Prisma data for Dependant');
    }
    const d = data as Record<string, unknown>;
    return new Dependant({
      id: d.id as string,
      customerId: d.customerId as string,
      firstName: d.firstName as string,
      middleName: d.middleName as string | null | undefined,
      lastName: d.lastName as string,
      dateOfBirth: d.dateOfBirth as Date | null | undefined,
      gender: d.gender as Gender | null | undefined,
      idType: d.idType as IdType | null | undefined,
      idNumber: d.idNumber as string | null | undefined,
      relationship: d.relationship as DependantRelationship,
      isVerified: d.isVerified as boolean,
      verifiedAt: d.verifiedAt as Date | null | undefined,
      verifiedBy: d.verifiedBy as string | null | undefined,
      verificationRequired: (d.verificationRequired ?? false) as boolean,
      createdByPartnerId: String(d.createdByPartnerId),
      createdAt: d.createdAt as Date,
      updatedAt: d.updatedAt as Date,
    });
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
