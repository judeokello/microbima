import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentRegistrationDto, UpdateAgentRegistrationDto, AgentRegistrationResponseDto } from '../dto/agent-registration';
import { RegistrationStatus, RegistrationMissingStatus, Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class AgentRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new agent registration
   */
  async createRegistration(dto: CreateAgentRegistrationDto, userId: string): Promise<AgentRegistrationResponseDto> {
    try {
      // First, try to find Brand Ambassador by ID (if baId is a UUID)
      let ba = await this.prisma.brandAmbassador.findFirst({
        where: {
          id: dto.baId,
          isActive: true,
        },
        include: {
          partner: true,
        },
      });

      // If not found by ID, try to find by userId (if baId is actually a user ID)
      ba ??= await this.prisma.brandAmbassador.findFirst({
        where: {
          userId: dto.baId,
          isActive: true,
        },
        include: {
          partner: true,
        },
      });

      if (!ba) {
        throw new BadRequestException('Brand Ambassador not found or inactive');
      }

      // Validate that customer exists
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });

      if (!customer) {
        throw new BadRequestException('Customer not found');
      }

      // Derive partner ID from BA record (Option A implementation)
      const partnerId = ba.partnerId;

      // If partnerId is provided, validate it matches the BA's partner
      if (dto.partnerId && ba.partnerId !== parseInt(dto.partnerId)) {
        throw new BadRequestException('Partner mismatch - provided partnerId does not match BA record');
      }

      // Create the registration
      const registration = await this.prisma.agentRegistration.create({
        data: {
          baId: ba.id, // Use the actual Brand Ambassador ID
          customerId: dto.customerId,
          partnerId: partnerId, // Use partner ID from BA record
          registrationStatus: dto.registrationStatus ?? RegistrationStatus.IN_PROGRESS,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
        },
        include: {
          ba: {
            select: {
              id: true,
              displayName: true,
              phoneNumber: true,
              perRegistrationRateCents: true,
              isActive: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              phoneNumber: true,
              hasMissingRequirements: true,
            },
          },
          partner: {
            select: {
              id: true,
              partnerName: true,
              isActive: true,
            },
          },
          missingRequirements: true,
        },
      });

      // Create missing requirements based on deferred requirements
      await this.createMissingRequirements(registration.id, dto.customerId, partnerId);

      return this.mapToResponseDto(registration);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'createRegistration',
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
   * Get registration by ID
   */
  async getRegistrationById(id: string, userId: string, isAdmin: boolean = false): Promise<AgentRegistrationResponseDto> {
    try {
      const registration = await this.prisma.agentRegistration.findUnique({
        where: { id },
        include: {
          ba: {
            select: {
              id: true,
              displayName: true,
              phoneNumber: true,
              perRegistrationRateCents: true,
              isActive: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              phoneNumber: true,
              hasMissingRequirements: true,
            },
          },
          partner: {
            select: {
              id: true,
              partnerName: true,
              isActive: true,
            },
          },
          missingRequirements: true,
        },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found');
      }

      return this.mapToResponseDto(registration, isAdmin);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'getRegistrationById',
          userId,
          registrationId: id,
        },
      });
      throw error;
    }
  }

  /**
   * Update registration
   */
  async updateRegistration(
    id: string,
    dto: UpdateAgentRegistrationDto,
    userId: string
  ): Promise<AgentRegistrationResponseDto> {
    try {
      const existingRegistration = await this.prisma.agentRegistration.findUnique({
        where: { id },
      });

      if (!existingRegistration) {
        throw new NotFoundException('Registration not found');
      }

      const updateData: Prisma.AgentRegistrationUpdateInput = {};
      if (dto.registrationStatus) {
        updateData.registrationStatus = dto.registrationStatus;
      }
      if (dto.completedAt) {
        updateData.completedAt = new Date(dto.completedAt);
      }

      const registration = await this.prisma.agentRegistration.update({
        where: { id },
        data: updateData,
        include: {
          ba: {
            select: {
              id: true,
              displayName: true,
              phoneNumber: true,
              perRegistrationRateCents: true,
              isActive: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              phoneNumber: true,
              hasMissingRequirements: true,
            },
          },
          partner: {
            select: {
              id: true,
              partnerName: true,
              isActive: true,
            },
          },
          missingRequirements: true,
        },
      });

      return this.mapToResponseDto(registration);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'updateRegistration',
          userId,
          registrationId: id,
        },
        extra: {
          dto,
        },
      });
      throw error;
    }
  }

  /**
   * Get registrations by BA ID
   */
  async getRegistrationsByBA(
    baId: string,
    userId: string,
    isAdmin: boolean = false,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ registrations: AgentRegistrationResponseDto[]; total: number }> {
    try {
      const [registrations, total] = await Promise.all([
        this.prisma.agentRegistration.findMany({
          where: { baId },
          include: {
            ba: {
              select: {
                id: true,
                displayName: true,
                phoneNumber: true,
                perRegistrationRateCents: true,
                isActive: true,
              },
            },
            customer: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                phoneNumber: true,
                hasMissingRequirements: true,
              },
            },
            partner: {
              select: {
                id: true,
                partnerName: true,
                isActive: true,
              },
            },
            missingRequirements: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.agentRegistration.count({
          where: { baId },
        }),
      ]);

      return {
        registrations: registrations.map(reg => this.mapToResponseDto(reg, isAdmin)),
        total,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'getRegistrationsByBA',
          userId,
          baId,
        },
      });
      throw error;
    }
  }

  /**
   * Create missing requirements for a registration
   */
  private async createMissingRequirements(
    registrationId: string,
    customerId: string,
    partnerId: number
  ): Promise<void> {
    try {
      // Get deferred requirements for the partner (or default if none exist)
      const partnerRequirements = await this.prisma.deferredRequirementPartner.findMany({
        where: { partnerId },
      });

      let requirements = partnerRequirements;

      // If no partner-specific requirements, use defaults
      if (requirements.length === 0) {
        const defaultRequirements = await this.prisma.deferredRequirementDefault.findMany();
        // Map default requirements to include partnerId
        requirements = defaultRequirements.map(req => ({
          ...req,
          partnerId,
        }));
      }

      // Create missing requirements for required fields
      const missingRequirements = requirements
        .filter(req => req.isRequired)
        .map(req => ({
          registrationId,
          customerId,
          partnerId,
          entityKind: req.entityKind,
          entityId: null, // Will be set when specific entities are created
          fieldPath: req.fieldPath,
          status: RegistrationMissingStatus.PENDING,
        }));

      if (missingRequirements.length > 0) {
        await this.prisma.missingRequirement.createMany({
          data: missingRequirements,
        });
      }

      // Update customer's hasMissingRequirements flag
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { hasMissingRequirements: missingRequirements.length > 0 },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'createMissingRequirements',
          registrationId,
          customerId,
          partnerId,
        },
      });
      throw error;
    }
  }

  /**
   * Map Prisma result to response DTO
   */
  private mapToResponseDto(registration: unknown, _isAdmin: boolean = false): AgentRegistrationResponseDto {
    if (!registration || typeof registration !== 'object') {
      throw new Error('Invalid registration data');
    }
    const reg = registration as Record<string, unknown>;
    return {
      id: reg.id as string,
      baId: reg.baId as string,
      customerId: reg.customerId as string,
      partnerId: reg.partnerId as number,
      registrationStatus: reg.registrationStatus as RegistrationStatus,
      completedAt: reg.completedAt ? (reg.completedAt as Date) : undefined,
      createdAt: reg.createdAt as Date,
      updatedAt: reg.updatedAt as Date,
      ba: reg.ba as {
        id: string;
        displayName: string;
        phoneNumber?: string;
        perRegistrationRateCents: number;
        isActive: boolean;
      } | undefined,
      customer: reg.customer as {
        id: string;
        firstName: string;
        middleName?: string | undefined;
        lastName: string;
        phoneNumber: string;
        hasMissingRequirements: boolean;
      } | undefined,
      partner: reg.partner as {
        id: number;
        partnerName: string;
        isActive: boolean;
      } | undefined,
      missingRequirements: Array.isArray(reg.missingRequirements)
        ? reg.missingRequirements.map((mr: unknown) => {
            if (!mr || typeof mr !== 'object') return null;
            const mrObj = mr as Record<string, unknown>;
            return {
              id: mrObj.id as string,
              entityKind: mrObj.entityKind as string,
              entityId: mrObj.entityId as string | undefined,
              fieldPath: mrObj.fieldPath as string,
              status: mrObj.status as RegistrationMissingStatus,
              createdAt: mrObj.createdAt as Date,
            };
          }).filter((mr): mr is NonNullable<typeof mr> => mr !== null)
        : undefined,
    };
  }
}
