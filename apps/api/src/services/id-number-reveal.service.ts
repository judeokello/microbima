import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DependantRelationship } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../exceptions/validation.exception';
import { hasGlobalCustomerAccess } from '../utils/roles.util';
import { IdNumberEntityKind, PiiRevealField } from '../dto/customers/reveal-id-number.dto';

type PiiRow = {
  idNumber?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: Date | null;
};

@Injectable()
export class IdNumberRevealService {
  private readonly logger = new Logger(IdNumberRevealService.name);

  constructor(private readonly prisma: PrismaService) {}

  async reveal(params: {
    customerId: string;
    entityKind: IdNumberEntityKind;
    entityId: string | undefined;
    field: PiiRevealField | undefined;
    userId: string;
    userRoles: string[];
    correlationId: string;
  }): Promise<{ value: string; idNumber?: string }> {
    const { customerId, entityKind, entityId, userId, userRoles, correlationId } = params;
    const field = params.field ?? PiiRevealField.ID_NUMBER;

    const canAccess = await this.canUserAccessCustomer(customerId, userId, userRoles);
    if (!canAccess) {
      throw new NotFoundException('Customer not found or not accessible');
    }

    const row = await this.resolveRow(customerId, entityKind, entityId);
    const value = this.pickField(row, field);
    if (!value) {
      this.logger.log(
        `[${correlationId}] PII reveal found no value customer=${customerId} kind=${entityKind} field=${field}`
      );
      throw new NotFoundException('Value not found');
    }

    this.logger.log(
      `[${correlationId}] PII revealed customer=${customerId} kind=${entityKind} field=${field}`
    );
    return field === PiiRevealField.ID_NUMBER ? { value, idNumber: value } : { value };
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
    if (!trimmed) {
      return null;
    }
    return trimmed;
  }

  private pickField(row: PiiRow | null, field: PiiRevealField): string | null {
    if (!row) {
      return null;
    }
    if (field === PiiRevealField.ID_NUMBER) {
      return this.nonemptyTrim(row.idNumber);
    }
    if (field === PiiRevealField.PHONE) {
      return this.nonemptyTrim(row.phoneNumber);
    }
    if (!row.dateOfBirth) {
      return null;
    }
    return row.dateOfBirth.toISOString().split('T')[0];
  }

  private async resolveRow(
    customerId: string,
    entityKind: IdNumberEntityKind,
    entityId: string | undefined
  ): Promise<PiiRow | null> {
    if (entityKind === IdNumberEntityKind.CUSTOMER) {
      return this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { idNumber: true, phoneNumber: true, dateOfBirth: true },
      });
    }

    if (!entityId) {
      throw ValidationException.forField('entityId', 'entityId is required for this ID type');
    }

    if (entityKind === IdNumberEntityKind.SPOUSE || entityKind === IdNumberEntityKind.CHILD) {
      const relationship =
        entityKind === IdNumberEntityKind.SPOUSE
          ? DependantRelationship.SPOUSE
          : DependantRelationship.CHILD;
      return this.prisma.dependant.findFirst({
        where: {
          id: entityId,
          customerId,
          relationship,
        },
        select: { idNumber: true, phoneNumber: true, dateOfBirth: true },
      });
    }

    if (entityKind === IdNumberEntityKind.PARENT) {
      return this.prisma.customerParent.findFirst({
        where: { id: entityId, customerId },
        select: { idNumber: true, dateOfBirth: true },
      });
    }

    return this.prisma.beneficiary.findFirst({
      where: { id: entityId, customerId },
      select: { idNumber: true, phoneNumber: true, dateOfBirth: true },
    });
  }
}
