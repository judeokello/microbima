import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentFrequency, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from './policy.service';
import { MpesaStkPushService } from './mpesa-stk-push.service';
import { PackagePricingService } from './package-pricing/package-pricing.service';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { AdditionalPolicyRequestDto } from '../dto/policies/additional-policy.dto';
import { validateAdditionalProductEnrolment } from '../utils/additional-product.rules';
import { SharedMapperUtils } from '../mappers/shared.mapper.utils';
import { matchExistingPerson } from '../utils/person-duplicate.util';
import { hasGlobalCustomerAccess } from '../utils/roles.util';
import { isOccupyingPolicyStatus } from '../utils/occupying-policy.util';
import {
  maxDependantSlots,
  packageHasFamilyBands,
} from '../utils/family-category.util';
import { computeHouseholdPremium } from '../utils/household-premium.util';

@Injectable()
export class AdditionalPolicyService {
  private readonly logger = new Logger(AdditionalPolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly mpesaStkPushService: MpesaStkPushService,
    private readonly packagePricingService: PackagePricingService
  ) {}

  async getEligibility(customerId: string, userId: string, userRoles: string[]) {
    await this.assertAdminAccess(customerId, userId, userRoles);
    const enrolment = await this.policyService.loadEnrolmentSnapshots(customerId);
    const reasons: string[] = [];
    if (enrolment.customerStatus === 'TERMINATED') {
      reasons.push('Customer is terminated');
    }
    if (enrolment.snapshots.some((p) => p.status === 'TERMINATED')) {
      reasons.push('A policy on this customer is terminated');
    }
    const occupyingPostpaid = enrolment.snapshots.some(
      (p) => isOccupyingPolicyStatus(p.status) && p.isPostpaid
    );
    if (occupyingPostpaid) {
      reasons.push(
        'A postpaid policy is occupying. Deactivate it before adding another product.'
      );
    }
    return { canAdd: reasons.length === 0, blockedReasons: reasons };
  }

  async createAdditionalPolicy(
    customerId: string,
    dto: AdditionalPolicyRequestDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ) {
    await this.assertAdminAccess(customerId, userId, userRoles);
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        dependants: { where: { deletedAt: null } },
        beneficiaries: { where: { deletedAt: null } },
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const packageScheme = await this.prisma.packageScheme.findUnique({
      where: { id: dto.packageSchemeId },
      include: {
        scheme: { select: { isPostpaid: true, frequency: true, paymentCadence: true } },
        package: { select: { id: true, name: true } },
      },
    });
    if (!packageScheme || packageScheme.packageId !== dto.packageId) {
      throw ValidationException.forField(
        'packageSchemeId',
        'Scheme must belong to the selected package',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const enrolment = await this.policyService.loadEnrolmentSnapshots(customerId);
    const check = validateAdditionalProductEnrolment({
      customerStatus: enrolment.customerStatus,
      policies: enrolment.snapshots,
      newPackageId: dto.packageId,
      newIsPostpaid: packageScheme.scheme.isPostpaid,
    });
    if (!check.ok) {
      throw ValidationException.forField(check.field, check.message, ErrorCodes.RESOURCE_CONFLICT);
    }

    if (!dto.beneficiaryId && !dto.newBeneficiary) {
      throw ValidationException.forField(
        'beneficiaryId',
        'Exactly one beneficiary is required',
        ErrorCodes.NO_BENEFICIARIES_PROVIDED
      );
    }
    if (dto.beneficiaryId && dto.newBeneficiary) {
      throw ValidationException.forField(
        'beneficiaryId',
        'Select an existing beneficiary or create one, not both',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (dto.beneficiaryId && !customer.beneficiaries.some((b) => b.id === dto.beneficiaryId)) {
      throw ValidationException.forField(
        'beneficiaryId',
        'Beneficiary does not belong to this customer',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const unknownDependants = (dto.dependantIds ?? []).filter(
      (id) => !customer.dependants.some((d) => d.id === id)
    );
    if (unknownDependants.length > 0) {
      throw ValidationException.forField(
        'dependantIds',
        'One or more dependants do not belong to this customer',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const pricing = await this.packagePricingService.getPricing(dto.packageId);
    const bands = pricing.categories.map((c) => ({
      key: c.key,
      kind: c.kind,
      maxMembers: c.maxMembers,
    }));
    const hasFamily = packageHasFamilyBands(bands);
    const cap = maxDependantSlots(bands);
    const incomingDependantCount =
      (dto.dependantIds?.length ?? 0) + (dto.newSpouses?.length ?? 0) + (dto.newChildren?.length ?? 0);
    if (!hasFamily && incomingDependantCount > 0) {
      throw ValidationException.forField(
        'dependantIds',
        'This package is member-only and cannot cover spouses or children',
        ErrorCodes.VALIDATION_ERROR
      );
    }
    if (hasFamily && incomingDependantCount > cap) {
      throw ValidationException.forField(
        'dependantIds',
        `This product allows at most ${cap} spouse(s) or children`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const prepared = await this.prisma.$transaction(async (tx) => {
      await this.ensurePackageSchemeCustomer(
        tx,
        customerId,
        dto.packageSchemeId,
        customer.createdByPartnerId
      );

      const dependantIds = [...(dto.dependantIds ?? [])];
      if (dto.newSpouses?.length) {
        for (const spouse of dto.newSpouses) {
          const id = await this.createOrReuseDependant(tx, customer, spouse, 'SPOUSE', correlationId);
          dependantIds.push(id);
        }
      }
      if (dto.newChildren?.length) {
        for (const child of dto.newChildren) {
          const id = await this.createOrReuseDependant(tx, customer, child, 'CHILD', correlationId);
          dependantIds.push(id);
        }
      }

      let beneficiaryId = dto.beneficiaryId ?? null;
      if (!beneficiaryId && dto.newBeneficiary) {
        beneficiaryId = await this.createOrReuseBeneficiary(tx, customer, dto.newBeneficiary);
      }

      return { dependantIds, beneficiaryId };
    });

    let frequency = dto.frequency;
    const customDays = dto.customDays;
    if (packageScheme.scheme.isPostpaid) {
      frequency = packageScheme.scheme.frequency ?? dto.frequency;
    }

    const householdDependants =
      prepared.dependantIds.length === 0
        ? []
        : await this.prisma.dependant.findMany({
            where: { id: { in: prepared.dependantIds }, deletedAt: null },
            select: { relationship: true, deletedAt: true },
          });
    const priced = computeHouseholdPremium({
      pricing,
      packagePlanId: dto.packagePlanId,
      frequency,
      dependants: householdDependants,
    });
    if (!priced.ok) {
      throw ValidationException.forField('premium', priced.reason, ErrorCodes.VALIDATION_ERROR);
    }

    const created = await this.policyService.createPolicyWithoutPayments(
      {
        customerId,
        packageId: dto.packageId,
        packagePlanId: dto.packagePlanId,
        premium: priced.premium,
        annualPremium: priced.annualPremium,
        frequency,
        customDays,
        dependantIds: prepared.dependantIds,
        beneficiaryId: prepared.beneficiaryId,
      },
      correlationId
    );

    if (packageScheme.scheme.isPostpaid) {
      await this.prisma.policy.update({
        where: { id: created.id },
        data: {
          productName: dto.productName,
          frequency: frequency as PaymentFrequency,
          paymentCadence: packageScheme.scheme.paymentCadence ?? created.paymentCadence,
        },
      });
    }

    let stk = null;
    if (
      !dto.skipPayment &&
      dto.initiateStk !== false &&
      !packageScheme.scheme.isPostpaid &&
      dto.paymentPhone &&
      created.paymentAcNumber
    ) {
      stk = await this.mpesaStkPushService.initiateStkPush(
        {
          phoneNumber: dto.paymentPhone,
          amount: priced.premium,
          accountReference: created.paymentAcNumber,
          transactionDesc: `Premium payment for ${dto.productName}`,
        },
        correlationId,
        userId
      );
    }

    return {
      policy: created,
      stkPush: stk,
    };
  }

  private async assertAdminAccess(customerId: string, userId: string, userRoles: string[]) {
    if (!userRoles.includes('registration_admin') && !userRoles.includes('system_admin')) {
      throw ValidationException.forField(
        'user',
        'Only registration admins can add another product',
        ErrorCodes.INSUFFICIENT_PERMISSIONS
      );
    }
    if (hasGlobalCustomerAccess(userRoles)) return;
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
  }

  private async ensurePackageSchemeCustomer(
    tx: Prisma.TransactionClient,
    customerId: string,
    packageSchemeId: number,
    partnerId: number
  ) {
    const existing = await tx.packageSchemeCustomer.findFirst({
      where: { customerId, packageScheme: { packageId: (await tx.packageScheme.findUniqueOrThrow({ where: { id: packageSchemeId } })).packageId } },
    });
    if (existing) {
      await tx.packageSchemeCustomer.update({
        where: { id: existing.id },
        data: { packageSchemeId },
      });
      return;
    }
    await tx.packageSchemeCustomer.create({
      data: {
        customerId,
        packageSchemeId,
        partnerId,
        partnerCustomerId: '',
      },
    });
  }

  private async createOrReuseDependant(
    tx: Prisma.TransactionClient,
    customer: {
      id: string;
      createdByPartnerId: number;
      dependants: Array<{
        id: string;
        firstName: string;
        lastName: string;
        idNumber: string | null;
        phoneNumber: string | null;
      }>;
    },
    person: {
      firstName: string;
      lastName: string;
      middleName?: string;
      dateOfBirth?: string;
      gender?: string;
      idType?: string;
      idNumber?: string;
      phoneNumber?: string;
    },
    relationship: 'SPOUSE' | 'CHILD',
    _correlationId: string
  ): Promise<string> {
    const match = matchExistingPerson(person, customer.dependants);
    if (match.kind === 'auto') return match.person.id;
    if (match.kind === 'confirm') {
      throw ValidationException.forField(
        'dependants',
        'A similar dependant already exists. Select the existing record instead of creating a duplicate.',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const created = await tx.dependant.create({
      data: {
        customerId: customer.id,
        firstName: person.firstName,
        middleName: person.middleName ?? null,
        lastName: person.lastName,
        dateOfBirth: person.dateOfBirth ? new Date(person.dateOfBirth) : null,
        gender: person.gender ? SharedMapperUtils.mapGenderFromDto(person.gender) : null,
        idType: person.idType ? SharedMapperUtils.mapIdTypeFromDto(person.idType) : null,
        idNumber: person.idNumber ?? null,
        phoneNumber: person.phoneNumber ?? null,
        relationship,
        createdByPartnerId: customer.createdByPartnerId,
      },
    });
    return created.id;
  }

  private async createOrReuseBeneficiary(
    tx: Prisma.TransactionClient,
    customer: {
      id: string;
      createdByPartnerId: number;
      beneficiaries: Array<{
        id: string;
        firstName: string;
        lastName: string;
        idNumber: string | null;
        phoneNumber: string | null;
      }>;
    },
    person: {
      firstName: string;
      lastName: string;
      middleName?: string;
      dateOfBirth?: string;
      gender?: string;
      relationship?: string;
      relationshipDescription?: string;
      idType?: string;
      idNumber?: string;
      phoneNumber?: string;
      percentage?: number;
    }
  ): Promise<string> {
    const match = matchExistingPerson(person, customer.beneficiaries);
    if (match.kind === 'auto') return match.person.id;
    if (match.kind === 'confirm') {
      throw ValidationException.forField(
        'beneficiary',
        'A similar beneficiary already exists. Select the existing record instead of creating a duplicate.',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const created = await tx.beneficiary.create({
      data: {
        customerId: customer.id,
        firstName: person.firstName,
        middleName: person.middleName ?? null,
        lastName: person.lastName,
        dateOfBirth: person.dateOfBirth ? new Date(person.dateOfBirth) : null,
        gender: person.gender ? SharedMapperUtils.mapGenderFromDto(person.gender) : null,
        idType: person.idType ? SharedMapperUtils.mapIdTypeFromDto(person.idType) : null,
        idNumber: person.idNumber ?? null,
        phoneNumber: person.phoneNumber ?? null,
        relationship: person.relationship ?? 'other',
        relationshipDescription: person.relationshipDescription ?? null,
        percentage: person.percentage ?? 100,
        createdByPartnerId: customer.createdByPartnerId,
      },
    });
    return created.id;
  }
}
