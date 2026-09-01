import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DependantRelationship } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../exceptions/validation.exception';
import { hasGlobalCustomerAccess } from '../utils/roles.util';
import { IdNumberEntityKind } from '../dto/customers/reveal-id-number.dto';

@Injectable()
export class IdNumberRevealService {
  private readonly logger = new Logger(IdNumberRevealService.name);

  constructor(private readonly prisma: PrismaService) {}

  async reveal(params: {
    customerId: string;
    entityKind: IdNumberEntityKind;
    entityId: string | undefined;
    userId: string;
    userRoles: string[];
    correlationId: string;
  }): Promise<{ idNumber: string }> {
    const { customerId, entityKind, entityId, userId, userRoles, correlationId } = params;

    const canAccess = await this.canUserAccessCustomer(customerId, userId, userRoles);
    if (!canAccess) {
      throw new NotFoundException('Customer not found or not accessible');
    }

    const idNumber = await this.resolveIdNumber(customerId, entityKind, entityId);
    if (!idNumber) {
      this.logger.log(
        `[${correlationId}] ID number reveal found no value customer=${customerId} kind=${entityKind}`
      );
      throw new NotFoundException('ID number not found');
    }

    this.logger.log(
      `[${correlationId}] ID number revealed customer=${customerId} kind=${entityKind}`
    );
    return { idNumber };
  }

  private async canUserAccessCustomer(
    customerId: string,
    userId: string,
    userRoles: string[]
  ): Promise<boolean> {
    if (hasGlobalCustomerAccess(userRoles)) {
      return true;
    }
    if (userRoles.includes('brand_ambassador')) {
      const registration = await this.prisma.agentRegistration.findFirst({
        where: {
          customerId,
          ba: { userId },
        },
        select: { id: true },
      });
      return !!registration;
    }
    return false;
  }

  private nonemptyTrim(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private async resolveIdNumber(
    customerId: string,
    entityKind: IdNumberEntityKind,
    entityId: string | undefined
  ): Promise<string | null> {
    if (entityKind === IdNumberEntityKind.CUSTOMER) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { idNumber: true },
      });
      return this.nonemptyTrim(customer?.idNumber);
    }

    if (!entityId) {
      throw ValidationException.forField('entityId', 'entityId is required for this ID type');
    }

    if (entityKind === IdNumberEntityKind.SPOUSE || entityKind === IdNumberEntityKind.CHILD) {
      const relationship =
        entityKind === IdNumberEntityKind.SPOUSE
          ? DependantRelationship.SPOUSE
          : DependantRelationship.CHILD;
      const dependant = await this.prisma.dependant.findFirst({
        where: {
          id: entityId,
          customerId,
          relationship,
        },
        select: { idNumber: true },
      });
      return this.nonemptyTrim(dependant?.idNumber);
    }

    if (entityKind === IdNumberEntityKind.PARENT) {
      const parent = await this.prisma.customerParent.findFirst({
        where: { id: entityId, customerId },
        select: { idNumber: true },
      });
      return this.nonemptyTrim(parent?.idNumber);
    }

    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { id: entityId, customerId },
      select: { idNumber: true },
    });
    return this.nonemptyTrim(beneficiary?.idNumber);
  }
}
