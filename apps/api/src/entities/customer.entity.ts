import { CustomerStatus, OnboardingStep, Gender, IdType } from '@prisma/client';

export interface CustomerData {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  idType: IdType;
  idNumber: string;
  status: CustomerStatus;
  onboardingStep: OnboardingStep;
  createdByPartnerId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export class Customer {
  // Properties (all Prisma fields)
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  idType: IdType;
  idNumber: string;
  status: CustomerStatus;
  onboardingStep: OnboardingStep;
  createdByPartnerId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  constructor(data: CustomerData) {
    this.id = data.id;
    this.firstName = data.firstName;
    this.middleName = data.middleName;
    this.lastName = data.lastName;
    this.email = data.email;
    this.phoneNumber = data.phoneNumber;
    this.dateOfBirth = data.dateOfBirth;
    this.gender = data.gender;
    this.idType = data.idType;
    this.idNumber = data.idNumber;
    this.status = data.status;
    this.onboardingStep = data.onboardingStep;
    this.createdByPartnerId = data.createdByPartnerId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.createdBy = data.createdBy;
    this.updatedBy = data.updatedBy;
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
    const customerAge = this.age;
    return customerAge !== null && customerAge >= 18;
  }

  get isMinor(): boolean {
    const customerAge = this.age;
    return customerAge !== null && customerAge < 18;
  }

  get isActive(): boolean {
    return this.status === CustomerStatus.ACTIVE;
  }

  get isPendingKYC(): boolean {
    return this.status === CustomerStatus.PENDING_KYC;
  }

  get isKYCVerified(): boolean {
    return this.status === CustomerStatus.KYC_VERIFIED;
  }

  get isSuspended(): boolean {
    return this.status === CustomerStatus.SUSPENDED;
  }

  get isTerminated(): boolean {
    return this.status === CustomerStatus.TERMINATED;
  }

  // Business logic methods
  isEligibleForInsurance(): boolean {
    return this.isActive && this.isAdult && this.isKYCVerified;
  }

  canAddDependant(): boolean {
    return this.isActive && this.isAdult;
  }

  canAddBeneficiary(): boolean {
    return this.isActive && this.isAdult;
  }

  canProceedToNextOnboardingStep(): boolean {
    switch (this.onboardingStep) {
      case OnboardingStep.BASIC_INFO:
        return this.hasCompletedBasicInfo();
      case OnboardingStep.KYC_VERIFICATION:
        return this.isKYCVerified;
      case OnboardingStep.PLAN_SELECTION:
        return this.hasSelectedPlan();
      case OnboardingStep.PAYMENT_SETUP:
        return this.hasCompletedPaymentSetup();
      default:
        return false;
    }
  }

  getNextOnboardingStep(): OnboardingStep | null {
    if (!this.canProceedToNextOnboardingStep()) {
      return null;
    }

    switch (this.onboardingStep) {
      case OnboardingStep.BASIC_INFO:
        return OnboardingStep.KYC_VERIFICATION;
      case OnboardingStep.KYC_VERIFICATION:
        return OnboardingStep.PLAN_SELECTION;
      case OnboardingStep.PLAN_SELECTION:
        return OnboardingStep.PAYMENT_SETUP;
      case OnboardingStep.PAYMENT_SETUP:
        return OnboardingStep.ACTIVE;
      default:
        return null;
    }
  }

  // Validation methods
  validateBeforeSave(): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!this.firstName || this.firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    if (!this.email || this.email.trim().length === 0) {
      errors.push('Email is required');
    }

    if (!this.phoneNumber || this.phoneNumber.trim().length === 0) {
      errors.push('Phone number is required');
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

    if (this.lastName && this.lastName.length > 50) {
      errors.push('Last name must be less than 50 characters');
    }

    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Email must be a valid email address');
    }

    if (this.phoneNumber && !this.isValidPhoneNumber(this.phoneNumber)) {
      errors.push('Phone number must be a valid phone number');
    }

    if (this.dateOfBirth && this.dateOfBirth > new Date()) {
      errors.push('Date of birth cannot be in the future');
    }

    if (this.dateOfBirth && this.age !== null && this.age > 120) {
      errors.push('Age cannot be greater than 120 years');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateForUpdate(): ValidationResult {
    const errors: string[] = [];

    if (!this.id) {
      errors.push('Customer ID is required for updates');
    }

    const baseValidation = this.validateBeforeSave();
    errors.push(...baseValidation.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Helper methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone validation - can be enhanced based on requirements
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  private hasCompletedBasicInfo(): boolean {
    return !!(this.firstName && this.lastName && this.email && this.phoneNumber && this.idNumber);
  }

  private hasSelectedPlan(): boolean {
    // This would need to be implemented based on plan selection logic
    return false; // Placeholder
  }

  private hasCompletedPaymentSetup(): boolean {
    // This would need to be implemented based on payment setup logic
    return false; // Placeholder
  }

  // Data transformation methods
  toPrismaData(): any {
    return {
      id: this.id,
      firstName: this.firstName,
      middleName: this.middleName,
      lastName: this.lastName,
      email: this.email,
      phoneNumber: this.phoneNumber,
      dateOfBirth: this.dateOfBirth,
      gender: this.gender,
      idType: this.idType,
      idNumber: this.idNumber,
      status: this.status,
      onboardingStep: this.onboardingStep,
      createdByPartnerId: this.createdByPartnerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
    };
  }

  static fromPrismaData(data: any): Customer {
    return new Customer({
      id: data.id,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      idType: data.idType,
      idNumber: data.idNumber,
      status: data.status,
      onboardingStep: data.onboardingStep,
      createdByPartnerId: data.createdByPartnerId,
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
