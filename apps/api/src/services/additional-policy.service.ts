import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DependantRelationship, PaymentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from './policy.service';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { CreateAdditionalPolicyRequestDto } from '../dto/policies/additional-policy.dto';
import { hasGlobalCustomerAccess } from '../utils/roles.util';
import { OCCUPYING_POLICY_STATUSES } from '../utils/occupying-policy.util';
import { matchDuplicatePerson, type IdentifiedPerson } from '../utils/duplicate-person.util';
import { householdCapsFromBands } from '../utils/family-category.util';
import { SharedMapperUtils } from '../mappers/shared.mapper.utils';
import { SpouseDto } from '../dto/family-members/spouse.dto';
import { ChildDto } from '../dto/family-members/child.dto';
import { ParentDto } from '../dto/family-members/parent.dto';
import { BeneficiaryDto } from '../dto/family-members/beneficiary.dto';

@Injectable()
export class AdditionalPolicyService {
  private readonly logger = new Logger(AdditionalPolicyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService
  ) {}

  assertRegistrationAdmin(userRoles: string[]): void {
    if (!hasGlobalCustomerAccess(userRoles) && !userRoles.includes('registration_admin')) {
      throw ValidationException.forField(
        'authorization',
        'Only registration administrators can add an additional product',
        ErrorCodes.INSUFFICIENT_PERMISSIONS
      );
    }
    if (!userRoles.includes('registration_admin') && !userRoles.includes('system_admin')) {
      throw ValidationException.forField(
        'authorization',
        'Only registration administrators can add an additional product',
        ErrorCodes.INSUFFICIENT_PERMISSIONS
      );
    }
  }

  async createAdditionalPolicy(
    customerId: string,
    dto: CreateAdditionalPolicyRequestDto,
    userRoles: string[],
    correlationId: string
  ) {
    this.assertRegistrationAdmin(userRoles);

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        dependants: { where: { deletedAt: null } },
        beneficiaries: { where: { deletedAt: null } },
        policies: { select: { id: true, status: true } },
      },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const validationErrors: Record<string, string> = {};
    if (customer.status === 'TERMINATED') {
      validationErrors['status'] = 'Cannot add a product for a terminated customer';
    }
    if (customer.policies.some((p) => p.status === 'TERMINATED')) {
      validationErrors['policy'] = 'Cannot add a product while any policy is terminated';
    }
    if (!dto.beneficiaryId && !dto.newBeneficiary) {
      validationErrors['beneficiary'] = 'Exactly one beneficiary is required';
    }
    if (dto.beneficiaryId && dto.newBeneficiary) {
      validationErrors['beneficiary'] = 'Choose an existing next of kin or create one, not both';
    }
    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors);
    }

    const packageScheme = await this.prisma.packageScheme.findUnique({
      where: { id: dto.packageSchemeId },
      include: {
        package: {
          include: {
            packagePricingCategories: true,
            packagePlans: { where: { id: dto.packagePlanId } },
          },
        },
        scheme: {
          select: { isPostpaid: true, parentsSupported: true, schemeName: true },
        },
      },
    });
    if (!packageScheme) {
      throw ValidationException.forField('packageSchemeId', 'Package scheme not found');
    }
    const plan = packageScheme.package.packagePlans[0];
    if (!plan) {
      throw ValidationException.forField('packagePlanId', 'Plan not found for this package');
    }

    const bands = packageScheme.package.packagePricingCategories.map((c) => ({
      key: c.key,
      kind: c.kind,
      maxMembers: c.maxMembers,
    }));
    const caps = householdCapsFromBands(bands, packageScheme.scheme.parentsSupported);
    if (!caps.showParents && (dto.newParents?.length ?? 0) > 0) {
      throw ValidationException.forField(
        'newParents',
        'Parents are not available for this package and scheme'
      );
    }

    const existingSelected = customer.dependants.filter((d) =>
      (dto.existingDependantIds ?? []).includes(d.id)
    );
    const extraCount =
      existingSelected.filter((d) => d.relationship === 'SPOUSE' || d.relationship === 'CHILD')
        .length +
      (dto.newSpouses?.length ?? 0) +
      (dto.newChildren?.length ?? 0);
    if (!caps.hasFamilyBands && extraCount > 0) {
      throw ValidationException.forField(
        'household',
        'This package is member-only; spouses and children cannot be enrolled'
      );
    }
    if (caps.hasFamilyBands && extraCount > caps.maxExtraMembers) {
      throw ValidationException.forField(
        'household',
        `This package allows at most ${caps.maxExtraMembers} additional spouse(s)/child(ren)`
      );
    }

    const partnerId = customer.createdByPartnerId;
    const family = await this.prisma.$transaction(async (tx) => {
      const dependantIds = [...(dto.existingDependantIds ?? [])];

      if (dto.newSpouses?.length) {
        for (const spouse of dto.newSpouses) {
          const id = await this.createOrReuseDependant(
            tx,
            customerId,
            partnerId,
            'SPOUSE',
            spouse,
            customer.dependants,
            dto.confirmNewPersonKeys ?? [],
            correlationId
          );
          dependantIds.push(id);
        }
      }
      if (dto.newChildren?.length) {
        for (const child of dto.newChildren) {
          const id = await this.createOrReuseDependant(
            tx,
            customerId,
            partnerId,
            'CHILD',
            child,
            customer.dependants,
            dto.confirmNewPersonKeys ?? [],
            correlationId
          );
          dependantIds.push(id);
        }
      }
      if (dto.newParents?.length) {
        for (const parent of dto.newParents) {
          await this.createParent(tx, customerId, partnerId, parent);
        }
      }

      let beneficiaryId = dto.beneficiaryId ?? null;
      if (dto.newBeneficiary) {
        beneficiaryId = await this.createOrReuseBeneficiary(
          tx,
          customerId,
          partnerId,
          dto.newBeneficiary,
          customer.beneficiaries,
          dto.confirmNewPersonKeys ?? []
        );
      }
      if (!beneficiaryId) {
        throw ValidationException.forField('beneficiary', 'Exactly one beneficiary is required');
      }

      await this.ensurePackageSchemeCustomer(
        tx,
        customerId,
        dto.packageSchemeId,
        packageScheme.packageId,
        partnerId
      );

      return { dependantIds, beneficiaryId };
    });

    const isPostpaid = packageScheme.scheme.isPostpaid;
    const skipPayment = dto.skipPayment === true || isPostpaid;

    const created = skipPayment
      ? await this.policyService.createPolicyWithoutPayments(
          {
            customerId,
            packageId: packageScheme.packageId,
            packagePlanId: dto.packagePlanId,
            premium: dto.premium,
            annualPremium: dto.annualPremium,
            frequency: dto.frequency,
            customDays: dto.customDays,
            dependantIds: family.dependantIds,
            beneficiaryId: family.beneficiaryId,
          },
          correlationId
        )
      : (
          await this.policyService.createPolicyWithPayment(
            {
              customerId,
              packageId: packageScheme.packageId,
              packagePlanId: dto.packagePlanId,
              frequency: dto.frequency,
              premium: dto.premium,
              annualPremium: dto.annualPremium,
              productName: dto.productName,
              dependantIds: family.dependantIds,
              beneficiaryId: family.beneficiaryId,
              paymentData: {
                paymentType: PaymentType.MPESA,
                transactionReference: `PENDING-STK-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 10)
                  .toUpperCase()}`,
                amount: dto.premium,
                expectedPaymentDate: new Date(
                  Date.UTC(
                    new Date().getUTCFullYear(),
                    new Date().getUTCMonth(),
                    new Date().getUTCDate(),
                    new Date().getUTCHours(),
                    new Date().getUTCMinutes(),
                    new Date().getUTCSeconds()
                  )
                ),
              },
            },
            correlationId
          )
        ).policy;

    this.logger.log(
      `[${correlationId}] Additional policy ${created.id} created for customer ${customerId} PAN=${created.paymentAcNumber}`
    );

    return {
      status: 201,
      correlationId,
      message: 'Additional policy created successfully',
      policy: {
        id: created.id,
        policyNumber: created.policyNumber,
        status: created.status,
        productName: created.productName,
        premium: Number(created.premium),
        paymentAcNumber: created.paymentAcNumber,
      },
    };
  }

  private personKey(person: { firstName: string; lastName: string }): string {
    return `${person.firstName.trim().toLowerCase()}|${person.lastName.trim().toLowerCase()}`;
  }

  private async createOrReuseDependant(
    tx: Prisma.TransactionClient,
    customerId: string,
    partnerId: number,
    relationship: DependantRelationship,
    person: SpouseDto | ChildDto,
    existing: IdentifiedPerson[],
    confirmNewPersonKeys: string[],
    _correlationId: string
  ): Promise<string> {
    const match = matchDuplicatePerson(person, existing);
    if (match.kind === 'same_person') {
      return match.existing.id;
    }
    if (match.kind === 'ambiguous') {
      const key = this.personKey(person);
      if (!confirmNewPersonKeys.includes(key) && !confirmNewPersonKeys.includes(match.existing.id)) {
        throw ValidationException.forField(
          relationship === 'SPOUSE' ? 'newSpouses' : 'newChildren',
          `A person named ${person.firstName} ${person.lastName} already exists. Confirm they are the same person or a new one.`
        );
      }
    }

    const trimmedIdNumber = person.idNumber?.trim();
    const mappedIdType = person.idType
      ? SharedMapperUtils.mapIdTypeFromDto(person.idType)
      : null;
    const created = await tx.dependant.create({
      data: {
        customerId,
        firstName: person.firstName,
        middleName: person.middleName ?? null,
        lastName: person.lastName,
        dateOfBirth: person.dateOfBirth ? new Date(person.dateOfBirth) : null,
        gender: person.gender ? SharedMapperUtils.mapGenderFromDto(person.gender) : null,
        phoneNumber: 'phoneNumber' in person ? (person.phoneNumber ?? null) : null,
        idType: trimmedIdNumber ? mappedIdType : null,
        idNumber: trimmedIdNumber ?? null,
        relationship,
        createdByPartnerId: partnerId,
      },
    });
    return created.id;
  }

  private async createParent(
    tx: Prisma.TransactionClient,
    customerId: string,
    partnerId: number,
    parent: ParentDto
  ): Promise<void> {
    const trimmedIdNumber = parent.idNumber?.trim();
    await tx.customerParent.create({
      data: {
        customerId,
        firstName: parent.firstName,
        middleName: parent.middleName ?? null,
        lastName: parent.lastName,
        dateOfBirth: parent.dateOfBirth ? new Date(parent.dateOfBirth) : null,
        gender: SharedMapperUtils.mapGenderFromDto(parent.gender),
        idType: trimmedIdNumber ? SharedMapperUtils.mapIdTypeFromDto(parent.idType) : null,
        idNumber: trimmedIdNumber ?? null,
        relationship: parent.relationship,
        createdByPartnerId: partnerId,
      },
    });
  }

  private async createOrReuseBeneficiary(
    tx: Prisma.TransactionClient,
    customerId: string,
    partnerId: number,
    person: BeneficiaryDto,
    existing: IdentifiedPerson[],
    confirmNewPersonKeys: string[]
  ): Promise<string> {
    const match = matchDuplicatePerson(person, existing);
    if (match.kind === 'same_person') {
      return match.existing.id;
    }
    if (match.kind === 'ambiguous') {
      const key = this.personKey(person);
      if (!confirmNewPersonKeys.includes(key) && !confirmNewPersonKeys.includes(match.existing.id)) {
        throw ValidationException.forField(
          'newBeneficiary',
          `A next of kin named ${person.firstName} ${person.lastName} already exists. Confirm they are the same person or a new one.`
        );
      }
    }
    const trimmedIdNumber = person.idNumber?.trim();
    const created = await tx.beneficiary.create({
      data: {
        customerId,
        firstName: person.firstName,
        middleName: person.middleName ?? null,
        lastName: person.lastName,
        dateOfBirth: person.dateOfBirth ? new Date(person.dateOfBirth) : null,
        gender: SharedMapperUtils.mapGenderFromDto(person.gender),
        phoneNumber: person.phoneNumber ?? null,
        email: person.email ?? null,
        idType: trimmedIdNumber ? SharedMapperUtils.mapIdTypeFromDto(person.idType) : null,
        idNumber: trimmedIdNumber ?? null,
        relationship: person.relationship,
        relationshipDescription: person.relationshipDescription ?? null,
        percentage: 100,
        createdByPartnerId: partnerId,
      },
    });
    return created.id;
  }

  private async ensurePackageSchemeCustomer(
    tx: Prisma.TransactionClient,
    customerId: string,
    packageSchemeId: number,
    packageId: number,
    partnerId: number
  ): Promise<void> {
    const existing = await tx.packageSchemeCustomer.findFirst({
      where: {
        customerId,
        packageScheme: { packageId },
      },
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
      },
    });
  }
}

export const ADDITIONAL_POLICY_OCCUPYING = OCCUPYING_POLICY_STATUSES;
