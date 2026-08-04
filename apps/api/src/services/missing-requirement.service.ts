import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMissingRequirementDto,
  UpdateMissingRequirementDto,
  MissingRequirementResponseDto,
} from '../dto/missing-requirement';
import {
  CareOpsQueueEntityDto,
  CareOpsQueueResponseDto,
} from '../dto/missing-requirement/care-ops-queue.dto';
import {
  RegistrationMissingStatus,
  RegistrationEntityKind,
  DependantRelationship,
  Prisma,
} from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import {
  CompletenessPerson,
  getMissingRequiredFields,
  humanizeFieldPath,
  relationshipToEntityKind,
} from '../modules/missing-requirements/completeness.util';

/** Legacy deferred fields no longer required — resolve on sync. */
const RETIRED_FIELD_PATHS: Array<{ entityKind: RegistrationEntityKind; fieldPath: string }> = [
  { entityKind: RegistrationEntityKind.SPOUSE, fieldPath: 'idType' },
  { entityKind: RegistrationEntityKind.CHILD, fieldPath: 'idType' },
  { entityKind: RegistrationEntityKind.CHILD, fieldPath: 'idNumber' },
];

@Injectable()
export class MissingRequirementService {
  private readonly logger = new Logger(MissingRequirementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createMissingRequirement(
    dto: CreateMissingRequirementDto,
    userId: string
  ): Promise<MissingRequirementResponseDto> {
    try {
      const registration = await this.prisma.agentRegistration.findUnique({
        where: { id: dto.registrationId },
      });
      if (!registration) {
        throw new BadRequestException('Registration not found');
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found');
      }

      const missingRequirement = await this.prisma.missingRequirement.create({
        data: {
          registrationId: dto.registrationId,
          customerId: dto.customerId,
          partnerId: parseInt(dto.partnerId, 10),
          entityKind: dto.entityKind,
          entityId: dto.entityId,
          fieldPath: dto.fieldPath,
          status: dto.status ?? RegistrationMissingStatus.PENDING,
        },
      });

      await this.checkAndUpdateCustomerMissingRequirements(missingRequirement.customerId);
      return this.mapToResponseDto(missingRequirement);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'createMissingRequirement', userId },
        extra: { dto },
      });
      throw error;
    }
  }

  async getMissingRequirementById(id: string, userId: string): Promise<MissingRequirementResponseDto> {
    try {
      const missingRequirement = await this.prisma.missingRequirement.findUnique({
        where: { id },
      });
      if (!missingRequirement) {
        throw new NotFoundException('Missing requirement not found');
      }
      return this.mapToResponseDto(missingRequirement);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getMissingRequirementById', userId, missingRequirementId: id },
      });
      throw error;
    }
  }

  async updateMissingRequirement(
    id: string,
    dto: UpdateMissingRequirementDto,
    userId: string
  ): Promise<MissingRequirementResponseDto> {
    try {
      const existingRequirement = await this.prisma.missingRequirement.findUnique({
        where: { id },
      });
      if (!existingRequirement) {
        throw new NotFoundException('Missing requirement not found');
      }

      const updateData: Prisma.MissingRequirementUpdateInput = {};
      if (dto.status) updateData.status = dto.status;
      if (dto.resolvedAt) updateData.resolvedAt = new Date(dto.resolvedAt);
      if (dto.resolvedBy) updateData.resolvedBy = dto.resolvedBy;

      if (dto.status === RegistrationMissingStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = userId;
      }

      const missingRequirement = await this.prisma.missingRequirement.update({
        where: { id },
        data: updateData,
      });

      await this.checkAndUpdateCustomerMissingRequirements(missingRequirement.customerId);
      return this.mapToResponseDto(missingRequirement);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'updateMissingRequirement', userId, missingRequirementId: id },
        extra: { dto },
      });
      throw error;
    }
  }

  async getMissingRequirementsByRegistration(
    registrationId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ missingRequirements: MissingRequirementResponseDto[]; total: number }> {
    try {
      const [missingRequirements, total] = await Promise.all([
        this.prisma.missingRequirement.findMany({
          where: { registrationId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.missingRequirement.count({ where: { registrationId } }),
      ]);

      return {
        missingRequirements: missingRequirements.map((mr) => this.mapToResponseDto(mr)),
        total,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getMissingRequirementsByRegistration', userId, registrationId },
      });
      throw error;
    }
  }

  async getMissingRequirementsByCustomer(
    customerId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ missingRequirements: MissingRequirementResponseDto[]; total: number }> {
    try {
      const [missingRequirements, total] = await Promise.all([
        this.prisma.missingRequirement.findMany({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.missingRequirement.count({ where: { customerId } }),
      ]);

      return {
        missingRequirements: missingRequirements.map((mr) => this.mapToResponseDto(mr)),
        total,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getMissingRequirementsByCustomer', userId, customerId },
      });
      throw error;
    }
  }

  async getPendingMissingRequirements(
    userId: string,
    partnerId?: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ missingRequirements: MissingRequirementResponseDto[]; total: number }> {
    try {
      const whereClause: Prisma.MissingRequirementWhereInput = {
        status: RegistrationMissingStatus.PENDING,
      };
      if (partnerId) whereClause.partnerId = partnerId;

      const [missingRequirements, total] = await Promise.all([
        this.prisma.missingRequirement.findMany({
          where: whereClause,
          orderBy: { createdAt: 'asc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.missingRequirement.count({ where: whereClause }),
      ]);

      return {
        missingRequirements: missingRequirements.map((mr) => this.mapToResponseDto(mr)),
        total,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getPendingMissingRequirements', userId, partnerId },
      });
      throw error;
    }
  }

  /**
   * Care-ops queue: re-sync live fields for page of customers, then return
   * grouped incomplete spouse/child/beneficiary entities.
   */
  async getCareOpsQueue(params: {
    userId: string;
    limit?: number;
    offset?: number;
    partnerId?: number;
  }): Promise<CareOpsQueueResponseDto> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const customerWhere: Prisma.CustomerWhereInput = {
      isTestUser: false,
      missingRequirements: {
        some: {
          status: RegistrationMissingStatus.PENDING,
          ...(params.partnerId ? { partnerId: params.partnerId } : {}),
        },
      },
    };

    const [customerIdsPage, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: customerWhere,
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.customer.count({ where: customerWhere }),
    ]);

    for (const { id } of customerIdsPage) {
      await this.syncCustomerFromLiveData(id, params.userId);
    }

    const items: CareOpsQueueEntityDto[] = [];
    for (const { id: customerId } of customerIdsPage) {
      items.push(...(await this.buildQueueItemsForCustomer(customerId)));
    }

    return { items, total };
  }

  /**
   * Reconcile PENDING MRs with live dependant/beneficiary fields for a customer.
   * Creates MRs only for fields that are actually blank; resolves filled ones.
   */
  async syncCustomerFromLiveData(
    customerId: string,
    resolvedBy: string = 'system',
    opts?: { registrationId?: string; partnerId?: number }
  ): Promise<{ pendingCount: number }> {
    const registration =
      opts?.registrationId
        ? await this.prisma.agentRegistration.findUnique({ where: { id: opts.registrationId } })
        : await this.prisma.agentRegistration.findFirst({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
          });

    if (!registration && !opts?.registrationId) {
      // No registration — still clear flag if no pending MRs can be owned
      await this.checkAndUpdateCustomerMissingRequirements(customerId);
      return { pendingCount: 0 };
    }

    const registrationId = registration!.id;
    const partnerId = opts?.partnerId ?? registration!.partnerId;

    const [dependants, beneficiaries, existingPending] = await Promise.all([
      this.prisma.dependant.findMany({
        where: {
          customerId,
          deletedAt: null,
          relationship: { in: [DependantRelationship.SPOUSE, DependantRelationship.CHILD] },
        },
      }),
      this.prisma.beneficiary.findMany({
        where: { customerId, deletedAt: null },
      }),
      this.prisma.missingRequirement.findMany({
        where: { customerId, status: RegistrationMissingStatus.PENDING },
      }),
    ]);

    const desired = new Map<string, { entityKind: RegistrationEntityKind; entityId: string; fieldPath: string }>();

    for (const dep of dependants) {
      const kind = relationshipToEntityKind(dep.relationship);
      if (!kind) continue;
      const missing = getMissingRequiredFields(kind, dep);
      for (const fieldPath of missing) {
        desired.set(`${kind}:${dep.id}:${fieldPath}`, {
          entityKind: kind,
          entityId: dep.id,
          fieldPath,
        });
      }
    }

    for (const ben of beneficiaries) {
      const missing = getMissingRequiredFields(RegistrationEntityKind.BENEFICIARY, ben);
      for (const fieldPath of missing) {
        desired.set(`${RegistrationEntityKind.BENEFICIARY}:${ben.id}:${fieldPath}`, {
          entityKind: RegistrationEntityKind.BENEFICIARY,
          entityId: ben.id,
          fieldPath,
        });
      }
    }

    // Resolve retired field paths and anything no longer missing
    for (const mr of existingPending) {
      const isRetired = RETIRED_FIELD_PATHS.some(
        (r) => r.entityKind === mr.entityKind && r.fieldPath === mr.fieldPath
      );
      const key = mr.entityId
        ? `${mr.entityKind}:${mr.entityId}:${mr.fieldPath}`
        : null;
      const stillNeeded = key ? desired.has(key) : false;

      // Legacy rows without entityId: resolve if any live entity of that kind has the field
      let legacyStillNeeded = false;
      if (!mr.entityId && !isRetired) {
        legacyStillNeeded = Array.from(desired.values()).some(
          (d) => d.entityKind === mr.entityKind && d.fieldPath === mr.fieldPath
        );
      }

      if (isRetired || (mr.entityId && !stillNeeded) || (!mr.entityId && !legacyStillNeeded)) {
        await this.prisma.missingRequirement.update({
          where: { id: mr.id },
          data: {
            status: RegistrationMissingStatus.RESOLVED,
            resolvedAt: new Date(),
            resolvedBy,
          },
        });
      } else if (!mr.entityId && legacyStillNeeded) {
        // Attach to first matching live entity and keep pending
        const match = Array.from(desired.values()).find(
          (d) => d.entityKind === mr.entityKind && d.fieldPath === mr.fieldPath
        );
        if (match) {
          await this.prisma.missingRequirement.update({
            where: { id: mr.id },
            data: { entityId: match.entityId },
          });
        }
      }
    }

    const pendingAfterResolve = await this.prisma.missingRequirement.findMany({
      where: { customerId, status: RegistrationMissingStatus.PENDING },
    });
    const pendingKeys = new Set(
      pendingAfterResolve
        .filter((mr) => mr.entityId)
        .map((mr) => `${mr.entityKind}:${mr.entityId}:${mr.fieldPath}`)
    );

    const toCreate = Array.from(desired.entries())
      .filter(([key]) => !pendingKeys.has(key))
      .map(([, value]) => ({
        registrationId,
        customerId,
        partnerId,
        entityKind: value.entityKind,
        entityId: value.entityId,
        fieldPath: value.fieldPath,
        status: RegistrationMissingStatus.PENDING,
      }));

    if (toCreate.length > 0) {
      await this.prisma.missingRequirement.createMany({ data: toCreate });
    }

    const pendingCount = await this.checkAndUpdateCustomerMissingRequirements(customerId);
    return { pendingCount };
  }

  /**
   * Seed MRs for a new registration from live dependant/beneficiary data only.
   */
  async seedFromRegistration(
    registrationId: string,
    customerId: string,
    partnerId: number
  ): Promise<void> {
    await this.syncCustomerFromLiveData(customerId, 'system', { registrationId, partnerId });
  }

  private async buildQueueItemsForCustomer(customerId: string): Promise<CareOpsQueueEntityDto[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phoneNumber: true,
      },
    });
    if (!customer) return [];

    const registration = await this.prisma.agentRegistration.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    const pending = await this.prisma.missingRequirement.findMany({
      where: { customerId, status: RegistrationMissingStatus.PENDING },
    });
    if (!pending.length) return [];

    const byEntity = new Map<string, typeof pending>();
    for (const mr of pending) {
      const key = `${mr.entityKind}:${mr.entityId ?? 'none'}`;
      const list = byEntity.get(key) ?? [];
      list.push(mr);
      byEntity.set(key, list);
    }

    const customerName = [customer.firstName, customer.middleName, customer.lastName]
      .filter(Boolean)
      .join(' ');

    const items: CareOpsQueueEntityDto[] = [];

    for (const [key, mrs] of byEntity) {
      const [entityKindStr, entityIdRaw] = key.split(':');
      const entityKind = entityKindStr as RegistrationEntityKind;
      const entityId = entityIdRaw === 'none' ? null : entityIdRaw;

      let person: CompletenessPerson | null = null;
      if (
        entityId &&
        (entityKind === RegistrationEntityKind.SPOUSE || entityKind === RegistrationEntityKind.CHILD)
      ) {
        person = await this.prisma.dependant.findUnique({ where: { id: entityId } });
      } else if (entityId && entityKind === RegistrationEntityKind.BENEFICIARY) {
        person = await this.prisma.beneficiary.findUnique({ where: { id: entityId } });
      }

      const missingFields = person
        ? getMissingRequiredFields(entityKind, person)
        : [...new Set(mrs.map((m) => m.fieldPath))];

      if (!missingFields.length) continue;

      const entityName = person
        ? [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') ||
          entityKind
        : entityKind;

      items.push({
        customerId,
        customerName,
        customerPhone: customer.phoneNumber,
        registrationId: registration?.id ?? mrs[0]?.registrationId,
        partnerId: registration?.partnerId ?? mrs[0]?.partnerId,
        entityKind,
        entityId,
        entityName,
        missingFields,
        missingFieldLabels: missingFields.map(humanizeFieldPath),
        firstName: person?.firstName ?? null,
        middleName: person?.middleName ?? null,
        lastName: person?.lastName ?? null,
        gender: person?.gender ?? null,
        idType: person?.idType ?? null,
        idNumber: person?.idNumber ?? null,
        dateOfBirth: person?.dateOfBirth
          ? person.dateOfBirth instanceof Date
            ? person.dateOfBirth.toISOString().slice(0, 10)
            : String(person.dateOfBirth).slice(0, 10)
          : null,
      });
    }

    return items;
  }

  private async checkAndUpdateCustomerMissingRequirements(customerId: string): Promise<number> {
    const pendingCount = await this.prisma.missingRequirement.count({
      where: {
        customerId,
        status: RegistrationMissingStatus.PENDING,
      },
    });

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { hasMissingRequirements: pendingCount > 0 },
    });

    return pendingCount;
  }

  /** Exposed for tests / callers that only need the flag refresh. */
  async refreshCustomerMissingFlag(customerId: string): Promise<number> {
    return this.checkAndUpdateCustomerMissingRequirements(customerId);
  }

  private mapToResponseDto(missingRequirement: unknown): MissingRequirementResponseDto {
    if (!missingRequirement || typeof missingRequirement !== 'object') {
      throw new Error('Invalid missing requirement data');
    }
    const req = missingRequirement as Record<string, unknown>;
    return {
      id: req.id as string,
      registrationId: req.registrationId as string,
      customerId: req.customerId as string,
      partnerId: req.partnerId as number,
      entityKind: req.entityKind as RegistrationEntityKind,
      entityId: req.entityId as string | undefined,
      fieldPath: req.fieldPath as string,
      status: req.status as RegistrationMissingStatus,
      resolvedAt: req.resolvedAt as Date | undefined,
      resolvedBy: req.resolvedBy as string | undefined,
      createdAt: req.createdAt as Date,
      updatedAt: req.updatedAt as Date,
    };
  }
}
