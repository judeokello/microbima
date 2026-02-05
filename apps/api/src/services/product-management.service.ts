import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { PaymentAccountNumberService } from './payment-account-number.service';
import { PaymentFrequency } from '@prisma/client';
import { PAYMENT_CADENCE } from '../constants/payment-cadence.constants';
import * as Sentry from '@sentry/nestjs';

/**
 * Product Management Service
 *
 * Handles product-related business logic for packages, schemes, plans, and tags
 *
 * Features:
 * - Package retrieval
 * - Scheme retrieval for packages
 * - Plan retrieval for packages
 * - Tag management (search, create, retrieve by scheme)
 * - Postpaid scheme support with payment account numbers
 */
@Injectable()
export class ProductManagementService {
  private readonly logger = new Logger(ProductManagementService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentAccountNumberService: PaymentAccountNumberService
  ) {}

  /**
   * Get all active packages
   * @param correlationId - Correlation ID for tracing
   * @returns List of active packages
   */
  async getPackages(correlationId: string) {
    this.logger.log(`[${correlationId}] Getting all active packages`);

    try {
      const packages = await this.prismaService.package.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      this.logger.log(`[${correlationId}] Found ${packages.length} active packages`);
      return packages;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting packages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get active schemes for a package
   * @param packageId - Package ID
   * @param correlationId - Correlation ID for tracing
   * @returns List of active schemes for the package
   */
  async getPackageSchemes(packageId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting schemes for package ${packageId}`);

    try {
      // Verify package exists
      const packageExists = await this.prismaService.package.findUnique({
        where: { id: packageId },
        select: { id: true },
      });

      if (!packageExists) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      // Get schemes via package_schemes junction table
      const packageSchemes = await this.prismaService.packageScheme.findMany({
        where: {
          packageId: packageId,
          scheme: {
            isActive: true,
          },
        },
        include: {
          scheme: {
            select: {
              id: true,
              schemeName: true,
              description: true,
            },
          },
        },
        orderBy: {
          scheme: {
            schemeName: 'asc',
          },
        },
      });

      const schemes = packageSchemes.map((ps) => ({
        id: ps.scheme.id,
        name: ps.scheme.schemeName,
        description: ps.scheme.description,
        packageSchemeId: ps.id, // Include junction table ID for scheme assignment
      }));

      this.logger.log(`[${correlationId}] Found ${schemes.length} active schemes for package ${packageId}`);
      return schemes;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting package schemes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get active plans for a package
   * @param packageId - Package ID
   * @param correlationId - Correlation ID for tracing
   * @returns List of active plans for the package
   */
  async getPackagePlans(packageId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting plans for package ${packageId}`);

    try {
      // Verify package exists
      const packageExists = await this.prismaService.package.findUnique({
        where: { id: packageId },
        select: { id: true },
      });

      if (!packageExists) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      const plans = await this.prismaService.packagePlan.findMany({
        where: {
          packageId: packageId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Map null to undefined for DTO compatibility
      const plansDto = plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description ?? undefined,
      }));

      this.logger.log(`[${correlationId}] Found ${plans.length} active plans for package ${packageId}`);
      return plansDto;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting package plans: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get tags for a scheme
   * @param schemeId - Scheme ID
   * @param correlationId - Correlation ID for tracing
   * @returns List of tags for the scheme
   */
  async getSchemeTags(schemeId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting tags for scheme ${schemeId}`);

    try {
      // Verify scheme exists
      const schemeExists = await this.prismaService.scheme.findUnique({
        where: { id: schemeId },
        select: { id: true },
      });

      if (!schemeExists) {
        throw new NotFoundException(`Scheme with ID ${schemeId} not found`);
      }

      const schemeTags = await this.prismaService.schemeTag.findMany({
        where: {
          schemeId: schemeId,
        },
        include: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          tag: {
            name: 'asc',
          },
        },
      });

      const tags = schemeTags.map((st: { tag: { id: number; name: string } }) => ({
        id: st.tag.id,
        name: st.tag.name,
      }));

      this.logger.log(`[${correlationId}] Found ${tags.length} tags for scheme ${schemeId}`);
      return tags;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting scheme tags: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Search tags by name (for autocomplete)
   * @param search - Search query (min 3 characters)
   * @param limit - Maximum number of results (default: 10)
   * @param correlationId - Correlation ID for tracing
   * @returns List of matching tags
   */
  async searchTags(search: string, limit: number = 10, correlationId: string) {
    this.logger.log(`[${correlationId}] Searching tags with query: "${search}"`);

    try {
      const tags = await this.prismaService.tag.findMany({
        where: {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          name: true,
        },
        take: limit,
        orderBy: {
          name: 'asc',
        },
      });

      this.logger.log(`[${correlationId}] Found ${tags.length} matching tags`);
      return tags;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error searching tags: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Create a new tag
   * @param name - Tag name
   * @param correlationId - Correlation ID for tracing
   * @returns Created tag
   */
  async createTag(name: string, correlationId: string) {
    this.logger.log(`[${correlationId}] Creating tag: "${name}"`);

    try {
      // Check if tag already exists (case-insensitive)
      const existingTag = await this.prismaService.tag.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingTag) {
        this.logger.log(`[${correlationId}] Tag "${name}" already exists, returning existing tag`);
        return {
          id: existingTag.id,
          name: existingTag.name,
        };
      }

      const tag = await this.prismaService.tag.create({
        data: {
          name: name.trim(),
        },
        select: {
          id: true,
          name: true,
        },
      });

      this.logger.log(`[${correlationId}] Created tag with ID ${tag.id}`);
      return tag;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error creating tag: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get package by ID with underwriter info
   * @param packageId - Package ID
   * @param correlationId - Correlation ID for tracing
   * @returns Package details with underwriter info
   */
  async getPackageById(packageId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting package ${packageId}`);

    try {
      const pkg = await this.prismaService.package.findUnique({
        where: { id: packageId },
        include: {
          underwriter: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!pkg) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      return {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        underwriterId: pkg.underwriterId,
        underwriterName: pkg.underwriter?.name ?? null,
        isActive: pkg.isActive,
        logoPath: pkg.logoPath,
        cardTemplateName: pkg.cardTemplateName ?? null,
        createdBy: pkg.createdBy,
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting package ${packageId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Update a package
   * @param packageId - Package ID
   * @param data - Package update data
   * @param correlationId - Correlation ID for tracing
   * @returns Updated package
   */
  async updatePackage(
    packageId: number,
    data: {
      name?: string;
      description?: string;
      underwriterId?: number;
      isActive?: boolean;
      logoPath?: string;
    },
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Updating package ${packageId}`);

    try {
      // Verify package exists
      const existing = await this.prismaService.package.findUnique({
        where: { id: packageId },
      });

      if (!existing) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      const pkg = await this.prismaService.package.update({
        where: { id: packageId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.underwriterId !== undefined && { underwriterId: data.underwriterId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.logoPath !== undefined && { logoPath: data.logoPath }),
        },
        include: {
          underwriter: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`[${correlationId}] Updated package ${packageId}`);

      return {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        underwriterId: pkg.underwriterId,
        underwriterName: pkg.underwriter?.name ?? null,
        isActive: pkg.isActive,
        logoPath: pkg.logoPath,
        createdBy: pkg.createdBy,
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error updating package ${packageId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get schemes for a package with customer counts
   * @param packageId - Package ID
   * @param correlationId - Correlation ID for tracing
   * @returns List of schemes with customer counts
   */
  async getPackageSchemesWithCounts(packageId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting schemes with counts for package ${packageId}`);

    try {
      // Verify package exists
      const packageExists = await this.prismaService.package.findUnique({
        where: { id: packageId },
        select: { id: true },
      });

      if (!packageExists) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      // Get schemes via package_schemes junction table with customer counts
      const packageSchemes = await this.prismaService.packageScheme.findMany({
        where: {
          packageId: packageId,
        },
        include: {
          scheme: {
            select: {
              id: true,
              schemeName: true,
              description: true,
              isActive: true,
              isPostpaid: true,
            },
          },
          packageSchemeCustomers: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          scheme: {
            schemeName: 'asc',
          },
        },
      });

      const schemes = packageSchemes.map((ps) => ({
        id: ps.scheme.id,
        schemeName: ps.scheme.schemeName,
        description: ps.scheme.description,
        isActive: ps.scheme.isActive,
        isPostpaid: ps.scheme.isPostpaid,
        customersCount: ps.packageSchemeCustomers.length,
      }));

      this.logger.log(`[${correlationId}] Found ${schemes.length} schemes for package ${packageId}`);
      return schemes;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting package schemes with counts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get scheme by ID
   * @param schemeId - Scheme ID
   * @param correlationId - Correlation ID for tracing
   * @returns Scheme details
   */
  async getSchemeById(schemeId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting scheme ${schemeId}`);

    try {
      const scheme = await this.prismaService.scheme.findUnique({
        where: { id: schemeId },
      });

      if (!scheme) {
        throw new NotFoundException(`Scheme with ID ${schemeId} not found`);
      }

      return {
        id: scheme.id,
        schemeName: scheme.schemeName,
        description: scheme.description,
        isActive: scheme.isActive,
        isPostpaid: scheme.isPostpaid,
        frequency: scheme.frequency,
        paymentCadence: scheme.paymentCadence,
        paymentAcNumber: scheme.paymentAcNumber,
        createdBy: scheme.createdBy,
        createdAt: scheme.createdAt.toISOString(),
        updatedAt: scheme.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting scheme ${schemeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Update a scheme
   * @param schemeId - Scheme ID
   * @param data - Scheme update data
   * @param correlationId - Correlation ID for tracing
   * @returns Updated scheme
   */
  async updateScheme(
    schemeId: number,
    data: {
      schemeName?: string;
      description?: string;
      isActive?: boolean;
    },
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Updating scheme ${schemeId}`);

    try {
      // Verify scheme exists
      const existing = await this.prismaService.scheme.findUnique({
        where: { id: schemeId },
      });

      if (!existing) {
        throw new NotFoundException(`Scheme with ID ${schemeId} not found`);
      }

      const scheme = await this.prismaService.scheme.update({
        where: { id: schemeId },
        data: {
          ...(data.schemeName !== undefined && { schemeName: data.schemeName }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      this.logger.log(`[${correlationId}] Updated scheme ${schemeId}`);

      return {
        id: scheme.id,
        schemeName: scheme.schemeName,
        description: scheme.description,
        isActive: scheme.isActive,
        isPostpaid: scheme.isPostpaid,
        frequency: scheme.frequency,
        paymentCadence: scheme.paymentCadence,
        paymentAcNumber: scheme.paymentAcNumber,
        createdBy: scheme.createdBy,
        createdAt: scheme.createdAt.toISOString(),
        updatedAt: scheme.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error updating scheme ${schemeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get customers for a scheme with pagination
   * @param schemeId - Scheme ID
   * @param page - Page number (default: 1)
   * @param pageSize - Items per page (default: 20)
   * @param correlationId - Correlation ID for tracing
   * @returns Paginated list of customers
   */
  async getSchemeCustomers(
    schemeId: number,
    page: number = 1,
    pageSize: number = 20,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Getting customers for scheme ${schemeId}, page ${page}, pageSize ${pageSize}`);

    try {
      // Verify scheme exists
      const schemeExists = await this.prismaService.scheme.findUnique({
        where: { id: schemeId },
        select: { id: true },
      });

      if (!schemeExists) {
        throw new NotFoundException(`Scheme with ID ${schemeId} not found`);
      }

      const validatedPage = Math.max(1, page);
      const validatedPageSize = Math.min(100, Math.max(1, pageSize));
      const skip = (validatedPage - 1) * validatedPageSize;

      // Get package schemes for this scheme
      const packageSchemes = await this.prismaService.packageScheme.findMany({
        where: {
          schemeId: schemeId,
        },
        select: {
          id: true,
        },
      });

      const packageSchemeIds = packageSchemes.map((ps) => ps.id);

      if (packageSchemeIds.length === 0) {
        return {
          data: [],
          pagination: {
            page: validatedPage,
            pageSize: validatedPageSize,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }

      // Get customers through package_scheme_customers
      const [packageSchemeCustomers, totalCount] = await Promise.all([
        this.prismaService.packageSchemeCustomer.findMany({
          where: {
            packageSchemeId: {
              in: packageSchemeIds,
            },
          },
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                phoneNumber: true,
                gender: true,
                createdAt: true,
                idType: true,
                idNumber: true,
                hasMissingRequirements: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: validatedPageSize,
        }),
        this.prismaService.packageSchemeCustomer.count({
          where: {
            packageSchemeId: {
              in: packageSchemeIds,
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / validatedPageSize);

      // Transform data for response
      const customers = packageSchemeCustomers.map((psc) => ({
        id: psc.customer.id,
        firstName: psc.customer.firstName,
        middleName: psc.customer.middleName ?? undefined,
        lastName: psc.customer.lastName,
        phoneNumber: psc.customer.phoneNumber,
        gender: psc.customer.gender?.toLowerCase() ?? 'unknown',
        createdAt: psc.customer.createdAt.toISOString(),
        idType: psc.customer.idType,
        idNumber: psc.customer.idNumber,
        hasMissingRequirements: psc.customer.hasMissingRequirements,
      }));

      this.logger.log(`[${correlationId}] Found ${customers.length} customers for scheme ${schemeId}`);

      return {
        data: customers,
        pagination: {
          page: validatedPage,
          pageSize: validatedPageSize,
          totalItems: totalCount,
          totalPages,
          hasNextPage: validatedPage < totalPages,
          hasPreviousPage: validatedPage > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting customers for scheme ${schemeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Create a new package
   * @param data - Package creation data
   * @param userId - User ID who is creating the package
   * @param correlationId - Correlation ID for tracing
   * @returns Created package
   */
  async createPackage(
    data: {
      name: string;
      description: string;
      underwriterId?: number;
      isActive?: boolean;
    },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Creating package: ${data.name}`);

    try {
      // Pre-save validation: Check for duplicates (name + underwriterId combination)
      const existingPackage = await this.prismaService.package.findFirst({
        where: {
          name: {
            equals: data.name,
            mode: 'insensitive',
          },
          underwriterId: data.underwriterId ?? null,
        },
      });

      if (existingPackage) {
        throw ValidationException.forField(
          'name',
          'A package with this name already exists for this underwriter',
          ErrorCodes.VALIDATION_ERROR
        );
      }

      const pkg = await this.prismaService.package.create({
        data: {
          name: data.name,
          description: data.description,
          underwriterId: data.underwriterId,
          isActive: data.isActive ?? false, // Default to false
          createdBy: userId,
        },
        include: {
          underwriter: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`[${correlationId}] Created package with ID ${pkg.id}`);

      return {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        underwriterId: pkg.underwriterId,
        underwriterName: pkg.underwriter?.name ?? null,
        isActive: pkg.isActive,
        logoPath: pkg.logoPath,
        createdBy: pkg.createdBy,
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error creating package: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );

      // Re-throw with more context if it's a Prisma error
      if (error instanceof Error) {
        if (error.message.includes('Unique constraint failed')) {
          throw new Error('A package with this name already exists for this underwriter');
        }
        if (error.message.includes('Foreign key constraint failed')) {
          throw new Error('Invalid underwriter ID');
        }
      }

      throw error;
    }
  }

  /**
   * Create a new scheme
   * @param data - Scheme creation data
   * @param userId - User ID who is creating the scheme
   * @param correlationId - Correlation ID for tracing
   * @returns Created scheme
   */
  async createScheme(
    data: {
      schemeName: string;
      description: string;
      isActive?: boolean;
      isPostpaid?: boolean;
      frequency?: PaymentFrequency;
      paymentCadence?: number;
      packageId?: number;
    },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Creating scheme: ${data.schemeName}`);

    try {
      // Pre-save validation
      const validationErrors: Record<string, string> = {};

      // Check for duplicate scheme name
      const existingScheme = await this.prismaService.scheme.findFirst({
        where: {
          schemeName: {
            equals: data.schemeName,
            mode: 'insensitive',
          },
        },
      });

      if (existingScheme) {
        validationErrors['schemeName'] = 'A scheme with this name already exists';
      }

      // Validate postpaid requirements
      let calculatedPaymentCadence: number | null = null;
      if (data.isPostpaid) {
        if (!data.frequency) {
          validationErrors['frequency'] = 'Payment frequency is required for postpaid schemes';
        } else {
          // Calculate payment cadence from frequency if not CUSTOM
          if (data.frequency === PaymentFrequency.CUSTOM) {
            if (!data.paymentCadence) {
              validationErrors['paymentCadence'] = 'Payment cadence is required when frequency is CUSTOM';
            } else {
              calculatedPaymentCadence = data.paymentCadence;
            }
          } else {
            // Calculate cadence from frequency constants
            calculatedPaymentCadence = PAYMENT_CADENCE[data.frequency];
            if (!calculatedPaymentCadence) {
              validationErrors['frequency'] = `Invalid payment frequency: ${data.frequency}`;
            }
          }
        }
      }

      // Throw all validation errors at once
      if (Object.keys(validationErrors).length > 0) {
        throw ValidationException.withMultipleErrors(validationErrors);
      }

      // Generate payment account number for postpaid schemes
      let paymentAcNumber: string | undefined;
      if (data.isPostpaid) {
        await this.prismaService.$transaction(async (tx) => {
          paymentAcNumber = await this.paymentAccountNumberService.generateForScheme(
            tx,
            correlationId
          );

          // Create the scheme
          const scheme = await tx.scheme.create({
            data: {
              schemeName: data.schemeName,
              description: data.description,
              isActive: data.isActive ?? true,
              isPostpaid: data.isPostpaid ?? false,
              frequency: data.frequency ?? null,
              paymentCadence: calculatedPaymentCadence,
              paymentAcNumber: paymentAcNumber ?? null,
              createdBy: userId,
            },
          });

          this.logger.log(
            `[${correlationId}] Created postpaid scheme with ID ${scheme.id} and payment account number ${paymentAcNumber}`
          );

          // Link scheme to package if packageId is provided
          if (data.packageId) {
            await tx.packageScheme.create({
              data: {
                packageId: data.packageId,
                schemeId: scheme.id,
              },
            });
            this.logger.log(`[${correlationId}] Linked scheme ${scheme.id} to package ${data.packageId}`);
          }

          return scheme;
        });

        // Retrieve the created scheme to return
        const createdScheme = await this.prismaService.scheme.findFirst({
          where: { paymentAcNumber },
        });

        return {
          id: createdScheme!.id,
          schemeName: createdScheme!.schemeName,
          description: createdScheme!.description,
          isActive: createdScheme!.isActive,
          isPostpaid: createdScheme!.isPostpaid,
          frequency: createdScheme!.frequency,
          paymentCadence: createdScheme!.paymentCadence,
          paymentAcNumber: createdScheme!.paymentAcNumber,
          createdBy: createdScheme!.createdBy,
          createdAt: createdScheme!.createdAt.toISOString(),
          updatedAt: createdScheme!.updatedAt.toISOString(),
        };
      } else {
        // Create non-postpaid scheme (no payment account number needed)
        const scheme = await this.prismaService.scheme.create({
          data: {
            schemeName: data.schemeName,
            description: data.description,
            isActive: data.isActive ?? true,
            isPostpaid: false,
            createdBy: userId,
          },
        });

        this.logger.log(`[${correlationId}] Created scheme with ID ${scheme.id}`);

        // Link scheme to package if packageId is provided
        if (data.packageId) {
          await this.prismaService.packageScheme.create({
            data: {
              packageId: data.packageId,
              schemeId: scheme.id,
            },
          });
          this.logger.log(`[${correlationId}] Linked scheme ${scheme.id} to package ${data.packageId}`);
        }

        return {
          id: scheme.id,
          schemeName: scheme.schemeName,
          description: scheme.description,
          isActive: scheme.isActive,
          isPostpaid: scheme.isPostpaid,
          frequency: scheme.frequency,
          paymentCadence: scheme.paymentCadence,
          paymentAcNumber: scheme.paymentAcNumber,
          createdBy: scheme.createdBy,
          createdAt: scheme.createdAt.toISOString(),
          updatedAt: scheme.updatedAt.toISOString(),
        };
      }
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error creating scheme: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );

      Sentry.captureException(error, {
        tags: {
          service: 'ProductManagementService',
          operation: 'createScheme',
          correlationId,
        },
        extra: { schemeName: data.schemeName, isPostpaid: data.isPostpaid },
      });

      // Re-throw with more context if it's a Prisma error
      if (error instanceof Error) {
        if (error.message.includes('Unique constraint failed')) {
          throw new Error('A scheme with this name already exists');
        }
        if (error.message.includes('Foreign key constraint failed')) {
          throw new Error('Invalid package ID');
        }
      }

      throw error;
    }
  }
}

