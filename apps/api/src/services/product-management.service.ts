import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from './supabase.service';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { PaymentAccountNumberService } from './payment-account-number.service';
import { PaymentFrequency, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PAYMENT_CADENCE } from '../constants/payment-cadence.constants';
import { trimOrNull, toTitleCase } from '../utils/string.util';
import {
  isValidPackageSlug,
  normalizePackageSlug,
  validateInstallmentCount,
} from '../utils/package-payment-frequency.util';
import * as Sentry from '@sentry/nestjs';

type PaymentFrequencyInput = { frequency: PaymentFrequency; installmentCount: number };

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
    private readonly paymentAccountNumberService: PaymentAccountNumberService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Get all active packages
   * @param correlationId - Correlation ID for tracing
   * @returns List of active packages
   */
  private validatePaymentFrequenciesInput(
    paymentFrequencies: PaymentFrequencyInput[]
  ): PaymentFrequencyInput[] {
    if (!paymentFrequencies?.length) {
      throw ValidationException.forField(
        'paymentFrequencies',
        'At least one payment frequency is required',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const seen = new Set<PaymentFrequency>();
    const validationErrors: Record<string, string> = {};
    const normalized: PaymentFrequencyInput[] = [];

    for (let i = 0; i < paymentFrequencies.length; i++) {
      const row = paymentFrequencies[i];
      const key = `paymentFrequencies[${i}]`;
      if (seen.has(row.frequency)) {
        validationErrors[key] = `Duplicate frequency: ${row.frequency}`;
        continue;
      }
      seen.add(row.frequency);
      const err = validateInstallmentCount(row.frequency, row.installmentCount);
      if (err) {
        validationErrors[key] = err;
        continue;
      }
      normalized.push({
        frequency: row.frequency,
        installmentCount: row.installmentCount,
      });
    }

    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors);
    }
    return normalized;
  }

  private async replacePackagePaymentFrequencies(
    tx: Prisma.TransactionClient,
    packageId: number,
    paymentFrequencies: PaymentFrequencyInput[]
  ): Promise<void> {
    await tx.packagePaymentFrequency.deleteMany({ where: { packageId } });
    if (paymentFrequencies.length === 0) return;
    await tx.packagePaymentFrequency.createMany({
      data: paymentFrequencies.map((pf) => ({
        packageId,
        frequency: pf.frequency,
        installmentCount: pf.installmentCount,
      })),
    });
  }

  private mapPaymentFrequencies(
    rows: { frequency: PaymentFrequency; installmentCount: number }[]
  ) {
    return rows.map((r) => ({
      frequency: r.frequency,
      installmentCount: r.installmentCount,
    }));
  }

  /** Extract Prisma P2002 unique-constraint target field names. */
  private getPrismaUniqueTargetFields(error: PrismaClientKnownRequestError): string[] {
    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.map(String);
    }
    if (typeof target === 'string' && target.length > 0) {
      return [target];
    }
    return [];
  }

  private mapPackageUniqueConstraintError(error: PrismaClientKnownRequestError): never {
    const fields = this.getPrismaUniqueTargetFields(error);
    const blob = `${error.message} ${fields.join(' ')}`.toLowerCase();

    if (fields.includes('slug') || blob.includes('slug')) {
      throw ValidationException.forField(
        'slug',
        'A package with this slug already exists',
        ErrorCodes.VALIDATION_ERROR
      );
    }
    if (fields.includes('name') || /\bname\b/.test(blob)) {
      throw ValidationException.forField(
        'name',
        'A package with this name already exists for this underwriter',
        ErrorCodes.VALIDATION_ERROR
      );
    }
    const label = fields.length > 0 ? fields.join(', ') : 'value';
    throw ValidationException.forField(
      'package',
      `A package with this ${label} already exists`,
      ErrorCodes.VALIDATION_ERROR
    );
  }

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
          slug: true,
          packagePaymentFrequencies: {
            select: { frequency: true, installmentCount: true },
            orderBy: { frequency: 'asc' },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      this.logger.log(`[${correlationId}] Found ${packages.length} active packages`);
      return packages.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        paymentFrequencies: this.mapPaymentFrequencies(p.packagePaymentFrequencies),
      }));
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
   * Get plans for a package
   * @param packageId - Package ID
   * @param correlationId - Correlation ID for tracing
   * @param includeInactive - When true, include inactive plans (admin); default active-only
   */
  async getPackagePlans(
    packageId: number,
    correlationId: string,
    includeInactive = false
  ) {
    this.logger.log(
      `[${correlationId}] Getting plans for package ${packageId} (includeInactive=${includeInactive})`
    );

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
          ...(includeInactive ? {} : { isActive: true }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      const plansDto = plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description ?? undefined,
        isActive: plan.isActive,
      }));

      this.logger.log(`[${correlationId}] Found ${plans.length} plans for package ${packageId}`);
      return plansDto;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting package plans: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  async createPackagePlan(
    packageId: number,
    data: { name: string; description?: string; isActive?: boolean },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Creating plan for package ${packageId}`);

    const packageExists = await this.prismaService.package.findUnique({
      where: { id: packageId },
      select: { id: true },
    });
    if (!packageExists) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    const name = toTitleCase(data.name);
    if (!name) {
      throw ValidationException.forField('name', 'Plan name is required', ErrorCodes.VALIDATION_ERROR);
    }

    const duplicate = await this.prismaService.packagePlan.findFirst({
      where: {
        packageId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw ValidationException.forField(
        'name',
        'A plan with this name already exists for this package',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    try {
      const plan = await this.prismaService.packagePlan.create({
        data: {
          packageId,
          name,
          description: trimOrNull(data.description ?? null),
          isActive: data.isActive ?? true,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description ?? undefined,
        isActive: plan.isActive,
      };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw ValidationException.forField(
          'name',
          'A plan with this name already exists for this package',
          ErrorCodes.VALIDATION_ERROR
        );
      }
      throw error;
    }
  }

  async updatePackagePlan(
    packageId: number,
    planId: number,
    data: { description?: string; isActive?: boolean },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Updating plan ${planId} for package ${packageId}`);

    const plan = await this.prismaService.packagePlan.findFirst({
      where: { id: planId, packageId },
      include: { package: { select: { id: true, isActive: true } } },
    });
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${planId} not found for package ${packageId}`);
    }

    if (data.isActive === false && plan.isActive && plan.package.isActive) {
      const otherActive = await this.prismaService.packagePlan.count({
        where: {
          packageId,
          isActive: true,
          NOT: { id: planId },
        },
      });
      if (otherActive < 1) {
        throw ValidationException.forField(
          'isActive',
          'Cannot deactivate the last active plan while the package is active',
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    const updated = await this.prismaService.packagePlan.update({
      where: { id: planId },
      data: {
        ...(data.description !== undefined && { description: trimOrNull(data.description) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedBy: userId,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description ?? undefined,
      isActive: updated.isActive,
    };
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
   * Resolve display name for createdBy userId: try Brand Ambassador first, then Supabase Auth.
   */
  private async getCreatedByDisplayName(userId: string): Promise<string> {
    const brandAmbassador = await this.prismaService.brandAmbassador.findUnique({
      where: { userId },
      select: { displayName: true },
    });
    if (brandAmbassador?.displayName) {
      return brandAmbassador.displayName;
    }
    return this.supabaseService.getUserDisplayName(userId);
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
          packagePaymentFrequencies: {
            select: { frequency: true, installmentCount: true },
            orderBy: { frequency: 'asc' },
          },
        },
      });

      if (!pkg) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      let createdByDisplayName: string | undefined;
      if (pkg.createdBy) {
        createdByDisplayName = await this.getCreatedByDisplayName(pkg.createdBy);
      }

      return {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        underwriterId: pkg.underwriterId,
        underwriterName: pkg.underwriter?.name ?? null,
        isActive: pkg.isActive,
        logoPath: pkg.logoPath,
        cardTemplateName: pkg.cardTemplateName ?? null,
        paymentFrequencies: this.mapPaymentFrequencies(pkg.packagePaymentFrequencies),
        createdBy: pkg.createdBy,
        createdByDisplayName,
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
      slug?: string;
      description?: string;
      underwriterId?: number;
      isActive?: boolean;
      logoPath?: string;
      paymentFrequencies?: PaymentFrequencyInput[];
    },
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Updating package ${packageId}`);

    try {
      const existing = await this.prismaService.package.findUnique({
        where: { id: packageId },
      });

      if (!existing) {
        throw new NotFoundException(`Package with ID ${packageId} not found`);
      }

      let normalizedSlug: string | undefined;
      if (data.slug !== undefined) {
        normalizedSlug = normalizePackageSlug(data.slug);
        if (!isValidPackageSlug(normalizedSlug)) {
          throw ValidationException.forField(
            'slug',
            'slug must be lowercase letters, numbers, and hyphens only',
            ErrorCodes.VALIDATION_ERROR
          );
        }
        const slugConflict = await this.prismaService.package.findFirst({
          where: {
            slug: normalizedSlug,
            NOT: { id: packageId },
          },
          select: { id: true },
        });
        if (slugConflict) {
          throw ValidationException.forField(
            'slug',
            'A package with this slug already exists',
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }

      const frequencies =
        data.paymentFrequencies !== undefined
          ? this.validatePaymentFrequenciesInput(data.paymentFrequencies)
          : undefined;

      if (data.isActive === true && !existing.isActive) {
        const activePlanCount = await this.prismaService.packagePlan.count({
          where: { packageId, isActive: true },
        });
        if (activePlanCount < 1) {
          throw ValidationException.forField(
            'isActive',
            'Package cannot be set to active without at least one active plan',
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }

      const pkg = await this.prismaService.$transaction(async (tx) => {
        const updated = await tx.package.update({
          where: { id: packageId },
          data: {
            ...(data.name !== undefined && { name: data.name.trim() }),
            ...(normalizedSlug !== undefined && { slug: normalizedSlug }),
            ...(data.description !== undefined && { description: data.description.trim() }),
            ...(data.underwriterId !== undefined && { underwriterId: data.underwriterId }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
            ...(data.logoPath !== undefined && { logoPath: trimOrNull(data.logoPath) }),
          },
          include: {
            underwriter: {
              select: {
                id: true,
                name: true,
              },
            },
            packagePaymentFrequencies: {
              select: { frequency: true, installmentCount: true },
              orderBy: { frequency: 'asc' },
            },
          },
        });

        if (frequencies) {
          await this.replacePackagePaymentFrequencies(tx, packageId, frequencies);
          return tx.package.findUniqueOrThrow({
            where: { id: packageId },
            include: {
              underwriter: { select: { id: true, name: true } },
              packagePaymentFrequencies: {
                select: { frequency: true, installmentCount: true },
                orderBy: { frequency: 'asc' },
              },
            },
          });
        }

        return updated;
      });

      this.logger.log(`[${correlationId}] Updated package ${packageId}`);

      return {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        underwriterId: pkg.underwriterId,
        underwriterName: pkg.underwriter?.name ?? null,
        isActive: pkg.isActive,
        logoPath: pkg.logoPath,
        paymentFrequencies: this.mapPaymentFrequencies(pkg.packagePaymentFrequencies),
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
   * Get all package-schemes with customer counts, package, and underwriter context
   * @param page - Page number (1-based)
   * @param pageSize - Items per page
   * @param correlationId - Correlation ID for tracing
   * @returns Paginated list of schemes with package/underwriter context
   */
  async getAllSchemesWithCounts(page: number, pageSize: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting all schemes with counts (page=${page}, pageSize=${pageSize})`);

    try {
      const validatedPage = Math.max(1, page);
      const validatedPageSize = Math.min(100, Math.max(1, pageSize));
      const skip = (validatedPage - 1) * validatedPageSize;

      const [packageSchemes, totalCount] = await Promise.all([
        this.prismaService.packageScheme.findMany({
          skip,
          take: validatedPageSize,
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
            package: {
              select: {
                id: true,
                name: true,
                underwriterId: true,
                underwriter: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            _count: {
              select: {
                packageSchemeCustomers: true,
              },
            },
          },
          orderBy: {
            scheme: {
              schemeName: 'asc',
            },
          },
        }),
        this.prismaService.packageScheme.count(),
      ]);

      const totalPages = Math.ceil(totalCount / validatedPageSize);

      const schemes = packageSchemes.map((ps) => ({
        id: ps.scheme.id,
        packageSchemeId: ps.id,
        schemeName: ps.scheme.schemeName,
        description: ps.scheme.description,
        isActive: ps.scheme.isActive,
        isPostpaid: ps.scheme.isPostpaid,
        generalSchemeWaitingPeriod: ps.generalSchemeWaitingPeriod,
        customersCount: ps._count.packageSchemeCustomers,
        packageId: ps.package.id,
        packageName: ps.package.name,
        underwriterId: ps.package.underwriterId ?? ps.package.underwriter?.id ?? null,
        underwriterName: ps.package.underwriter?.name ?? null,
      }));

      this.logger.log(`[${correlationId}] Found ${schemes.length} of ${totalCount} schemes`);

      return {
        data: schemes,
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
        `[${correlationId}] Error getting all schemes with counts: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        packageSchemeId: ps.id,
        schemeName: ps.scheme.schemeName,
        description: ps.scheme.description,
        isActive: ps.scheme.isActive,
        isPostpaid: ps.scheme.isPostpaid,
        generalSchemeWaitingPeriod: ps.generalSchemeWaitingPeriod,
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
  async getSchemeById(schemeId: number, correlationId: string, packageId?: number) {
    this.logger.log(`[${correlationId}] Getting scheme ${schemeId}`);

    try {
      const scheme = await this.prismaService.scheme.findUnique({
        where: { id: schemeId },
      });

      if (!scheme) {
        throw new NotFoundException(`Scheme with ID ${schemeId} not found`);
      }

      let createdByDisplayName: string | undefined;
      if (scheme.createdBy) {
        createdByDisplayName = await this.getCreatedByDisplayName(scheme.createdBy);
      }

      let packageSchemeId: number | undefined;
      let generalSchemeWaitingPeriod: number | null | undefined;
      if (packageId != null) {
        const link = await this.prismaService.packageScheme.findUnique({
          where: {
            packageId_schemeId: {
              packageId,
              schemeId,
            },
          },
          select: {
            id: true,
            generalSchemeWaitingPeriod: true,
          },
        });
        if (link) {
          packageSchemeId = link.id;
          generalSchemeWaitingPeriod = link.generalSchemeWaitingPeriod;
        }
      }

      return {
        id: scheme.id,
        packageSchemeId,
        schemeName: scheme.schemeName,
        description: scheme.description,
        isActive: scheme.isActive,
        isPostpaid: scheme.isPostpaid,
        frequency: scheme.frequency,
        paymentCadence: scheme.paymentCadence,
        paymentAcNumber: scheme.paymentAcNumber,
        packageId,
        generalSchemeWaitingPeriod: generalSchemeWaitingPeriod ?? null,
        createdBy: scheme.createdBy,
        createdByDisplayName,
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
   * Update waiting period on a package-scheme junction row.
   */
  async updatePackageSchemeWaitingPeriod(
    packageId: number,
    schemeId: number,
    generalSchemeWaitingPeriod: number,
    correlationId: string,
  ) {
    this.logger.log(
      `[${correlationId}] Updating package scheme waiting period packageId=${packageId} schemeId=${schemeId}`,
    );

    const validationErrors: Record<string, string> = {};
    if (generalSchemeWaitingPeriod < 0 || generalSchemeWaitingPeriod > 9999) {
      validationErrors['generalSchemeWaitingPeriod'] = 'Waiting period must be between 0 and 9999';
    }
    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors);
    }

    const existing = await this.prismaService.packageScheme.findUnique({
      where: { packageId_schemeId: { packageId, schemeId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Package scheme link not found for package ${packageId} and scheme ${schemeId}`,
      );
    }

    const updated = await this.prismaService.packageScheme.update({
      where: { id: existing.id },
      data: { generalSchemeWaitingPeriod },
    });

    return {
      packageSchemeId: updated.id,
      packageId: updated.packageId,
      schemeId: updated.schemeId,
      generalSchemeWaitingPeriod: updated.generalSchemeWaitingPeriod,
    };
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
          ...(data.schemeName !== undefined && { schemeName: data.schemeName.trim() }),
          ...(data.description !== undefined && { description: data.description.trim() }),
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
      slug: string;
      description: string;
      underwriterId?: number;
      isActive?: boolean;
      paymentFrequencies: PaymentFrequencyInput[];
    },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Creating package: ${data.name}`);

    try {
      const name = data.name.trim();
      const description = data.description.trim();
      const slug = normalizePackageSlug(data.slug);
      const frequencies = this.validatePaymentFrequenciesInput(data.paymentFrequencies);

      if (!isValidPackageSlug(slug)) {
        throw ValidationException.forField(
          'slug',
          'slug must be lowercase letters, numbers, and hyphens only',
          ErrorCodes.VALIDATION_ERROR
        );
      }

      const existingPackage = await this.prismaService.package.findFirst({
        where: {
          name: {
            equals: name,
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

      const slugConflict = await this.prismaService.package.findFirst({
        where: { slug },
        select: { id: true },
      });
      if (slugConflict) {
        throw ValidationException.forField(
          'slug',
          'A package with this slug already exists',
          ErrorCodes.VALIDATION_ERROR
        );
      }

      const pkg = await this.prismaService.$transaction(async (tx) => {
        const created = await tx.package.create({
          data: {
            name,
            slug,
            description,
            underwriterId: data.underwriterId,
            isActive: data.isActive ?? false,
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

        await this.replacePackagePaymentFrequencies(tx, created.id, frequencies);

        await tx.policyNumberSequence.create({
          data: {
            packageId: created.id,
            lastSequence: 0,
          },
        });

        return tx.package.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            underwriter: { select: { id: true, name: true } },
            packagePaymentFrequencies: {
              select: { frequency: true, installmentCount: true },
              orderBy: { frequency: 'asc' },
            },
          },
        });
      });

      this.logger.log(`[${correlationId}] Created package with ID ${pkg.id}`);

      return {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        underwriterId: pkg.underwriterId,
        underwriterName: pkg.underwriter?.name ?? null,
        isActive: pkg.isActive,
        logoPath: pkg.logoPath,
        paymentFrequencies: this.mapPaymentFrequencies(pkg.packagePaymentFrequencies),
        createdBy: pkg.createdBy,
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error creating package: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );

      if (error instanceof ValidationException) {
        throw error;
      }

      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          this.mapPackageUniqueConstraintError(error);
        }
        if (error.code === 'P2003') {
          throw ValidationException.forField(
            'underwriterId',
            'Invalid underwriter ID',
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }

      // Legacy string match for drivers that omit Prisma error codes
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        if (error.message.toLowerCase().includes('slug')) {
          throw ValidationException.forField(
            'slug',
            'A package with this slug already exists',
            ErrorCodes.VALIDATION_ERROR
          );
        }
        if (/\bname\b/i.test(error.message)) {
          throw ValidationException.forField(
            'name',
            'A package with this name already exists for this underwriter',
            ErrorCodes.VALIDATION_ERROR
          );
        }
        throw ValidationException.forField(
          'package',
          'A package with a conflicting unique value already exists',
          ErrorCodes.VALIDATION_ERROR
        );
      }
      if (error instanceof Error && error.message.includes('Foreign key constraint failed')) {
        throw ValidationException.forField(
          'underwriterId',
          'Invalid underwriter ID',
          ErrorCodes.VALIDATION_ERROR
        );
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
      generalSchemeWaitingPeriod?: number;
    },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Creating scheme: ${data.schemeName}`);

    try {
      // Trim string fields before validation and persistence
      const schemeName = data.schemeName.trim();
      const description = data.description.trim();

      // Pre-save validation
      const validationErrors: Record<string, string> = {};

      // Check for duplicate scheme name
      const existingScheme = await this.prismaService.scheme.findFirst({
        where: {
          schemeName: {
            equals: schemeName,
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
        } else if (data.frequency === PaymentFrequency.CUSTOM) {
          validationErrors['frequency'] =
            'CUSTOM frequency is not supported for postpaid schemes; use a package-supported frequency';
        } else {
          calculatedPaymentCadence = PAYMENT_CADENCE[data.frequency];
          if (!calculatedPaymentCadence) {
            validationErrors['frequency'] = `Invalid payment frequency: ${data.frequency}`;
          }
        }
      }

      if (data.packageId) {
        if (data.generalSchemeWaitingPeriod === undefined || data.generalSchemeWaitingPeriod === null) {
          validationErrors['generalSchemeWaitingPeriod'] =
            'Waiting period is required when linking a scheme to a package';
        } else if (data.generalSchemeWaitingPeriod < 0 || data.generalSchemeWaitingPeriod > 9999) {
          validationErrors['generalSchemeWaitingPeriod'] = 'Waiting period must be between 0 and 9999';
        }

        if (data.isPostpaid && data.frequency && !validationErrors['frequency']) {
          const supported = await this.prismaService.packagePaymentFrequency.findUnique({
            where: {
              packageId_frequency: {
                packageId: data.packageId,
                frequency: data.frequency,
              },
            },
            select: { id: true },
          });
          if (!supported) {
            validationErrors['frequency'] =
              'Payment frequency is not supported for this package';
          }
        }
      }

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
              schemeName,
              description,
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
                generalSchemeWaitingPeriod: data.generalSchemeWaitingPeriod ?? null,
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
            schemeName,
            description,
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
              generalSchemeWaitingPeriod: data.generalSchemeWaitingPeriod ?? null,
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

      if (error instanceof ValidationException) {
        throw error;
      }

      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const fields = this.getPrismaUniqueTargetFields(error);
          const blob = `${error.message} ${fields.join(' ')}`.toLowerCase();
          if (fields.includes('schemeName') || blob.includes('schemename') || blob.includes('scheme_name')) {
            throw ValidationException.forField(
              'schemeName',
              'A scheme with this name already exists',
              ErrorCodes.VALIDATION_ERROR
            );
          }
          const label = fields.length > 0 ? fields.join(', ') : 'value';
          throw ValidationException.forField(
            'scheme',
            `A scheme with this ${label} already exists`,
            ErrorCodes.VALIDATION_ERROR
          );
        }
        if (error.code === 'P2003') {
          throw ValidationException.forField(
            'packageId',
            'Invalid package ID',
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }

      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        throw ValidationException.forField(
          'schemeName',
          'A scheme with this name already exists',
          ErrorCodes.VALIDATION_ERROR
        );
      }
      if (error instanceof Error && error.message.includes('Foreign key constraint failed')) {
        throw ValidationException.forField(
          'packageId',
          'Invalid package ID',
          ErrorCodes.VALIDATION_ERROR
        );
      }

      throw error;
    }
  }
}

