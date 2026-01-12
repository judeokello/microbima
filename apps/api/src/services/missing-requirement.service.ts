import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMissingRequirementDto, UpdateMissingRequirementDto, MissingRequirementResponseDto } from '../dto/missing-requirement';
import { RegistrationMissingStatus, RegistrationEntityKind, Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class MissingRequirementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a missing requirement
   */
  async createMissingRequirement(dto: CreateMissingRequirementDto, userId: string): Promise<MissingRequirementResponseDto> {
    try {
      // Validate that registration exists
      const registration = await this.prisma.agentRegistration.findUnique({
        where: { id: dto.registrationId },
      });

      if (!registration) {
        throw new BadRequestException('Registration not found');
      }

      // Validate that customer exists
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
          partnerId: parseInt(dto.partnerId),
          entityKind: dto.entityKind,
          entityId: dto.entityId,
          fieldPath: dto.fieldPath,
          status: dto.status ?? RegistrationMissingStatus.PENDING,
        },
      });

      return this.mapToResponseDto(missingRequirement);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'createMissingRequirement',
          userId,
        },
        extra: {
          dto,
        },
      });
      throw error;
    }
  }

  /**
   * Get missing requirement by ID
   */
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
        tags: {
          operation: 'getMissingRequirementById',
          userId,
          missingRequirementId: id,
        },
      });
      throw error;
    }
  }

  /**
   * Update missing requirement
   */
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
      if (dto.status) {
        updateData.status = dto.status;
      }
      if (dto.resolvedAt) {
        updateData.resolvedAt = new Date(dto.resolvedAt);
      }
      if (dto.resolvedBy) {
        updateData.resolvedBy = dto.resolvedBy;
      }

      // If resolving, set resolved timestamp and user
      if (dto.status === RegistrationMissingStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = userId;
      }

      const missingRequirement = await this.prisma.missingRequirement.update({
        where: { id },
        data: updateData,
      });

      // Check if all missing requirements for this customer are resolved
      await this.checkAndUpdateCustomerMissingRequirements(missingRequirement.customerId);

      return this.mapToResponseDto(missingRequirement);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'updateMissingRequirement',
          userId,
          missingRequirementId: id,
        },
        extra: {
          dto,
        },
      });
      throw error;
    }
  }

  /**
   * Get missing requirements by registration ID
   */
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
        this.prisma.missingRequirement.count({
          where: { registrationId },
        }),
      ]);

      return {
        missingRequirements: missingRequirements.map(mr => this.mapToResponseDto(mr)),
        total,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'getMissingRequirementsByRegistration',
          userId,
          registrationId,
        },
      });
      throw error;
    }
  }

  /**
   * Get missing requirements by customer ID
   */
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
        this.prisma.missingRequirement.count({
          where: { customerId },
        }),
      ]);

      return {
        missingRequirements: missingRequirements.map(mr => this.mapToResponseDto(mr)),
        total,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'getMissingRequirementsByCustomer',
          userId,
          customerId,
        },
      });
      throw error;
    }
  }

  /**
   * Get pending missing requirements for admin resolution
   */
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

      if (partnerId) {
        whereClause.partnerId = partnerId;
      }

      const [missingRequirements, total] = await Promise.all([
        this.prisma.missingRequirement.findMany({
          where: whereClause,
          include: {
            registration: {
              include: {
                ba: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
                customer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.missingRequirement.count({
          where: whereClause,
        }),
      ]);

      return {
        missingRequirements: missingRequirements.map(mr => this.mapToResponseDto(mr)),
        total,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'getPendingMissingRequirements',
          userId,
          partnerId,
        },
      });
      throw error;
    }
  }

  /**
   * Check and update customer's hasMissingRequirements flag
   */
  private async checkAndUpdateCustomerMissingRequirements(customerId: string): Promise<void> {
    try {
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
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'checkAndUpdateCustomerMissingRequirements',
          customerId,
        },
      });
      throw error;
    }
  }

  /**
   * Map Prisma result to response DTO
   */
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
