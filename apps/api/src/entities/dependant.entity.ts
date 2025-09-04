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
  toPrismaData(): any {
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
      createdByPartnerId: this.createdByPartnerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromPrismaData(data: any): Dependant {
    return new Dependant({
      id: data.id,
      customerId: data.customerId,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      idType: data.idType,
      idNumber: data.idNumber,
      relationship: data.relationship,
      isVerified: data.isVerified,
      verifiedAt: data.verifiedAt,
      verifiedBy: data.verifiedBy,
      createdByPartnerId: data.createdByPartnerId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
