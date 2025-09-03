import { Gender, IdType } from '@prisma/client';

export interface BeneficiaryData {
  id: string;
  customerId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  idType: IdType;
  idNumber: string;
  relationship?: string | null;
  percentage?: number | null;
  createdByPartnerId: string;
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
  idType: IdType;
  idNumber: string;
  relationship?: string | null;
  percentage?: number | null;
  createdByPartnerId: string;
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
    this.idType = data.idType;
    this.idNumber = data.idNumber;
    this.relationship = data.relationship;
    this.percentage = data.percentage;
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

    if (!this.idNumber || this.idNumber.trim().length === 0) {
      errors.push('ID number is required');
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
      percentage: this.percentage,
      createdByPartnerId: this.createdByPartnerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromPrismaData(data: any): Beneficiary {
    return new Beneficiary({
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
      percentage: data.percentage,
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
