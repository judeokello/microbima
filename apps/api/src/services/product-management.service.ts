import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from './supabase.service';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { PaymentAccountNumberService } from './payment-account-number.service';
import { PaymentFrequency, Prisma, PackagePricingCategoryKind } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PAYMENT_CADENCE } from '../constants/payment-cadence.constants';
import { trimOrNull, toTitleCase } from '../utils/string.util';
import { maskIdNumberOrEmpty } from '../utils/id-number-masking';
import {
  isValidPackageSlug,
  normalizePackageSlug,
  validateInstallmentCount,
} from '../utils/package-payment-frequency.util';
import { derivePostpaidSchemeCoverageDates } from '../utils/postpaid-scheme-dates.util';
import * as Sentry from '@sentry/nestjs';
import { evaluatePackagePricingCompleteness } from './package-pricing/package-pricing-completeness';
import { PACKAGE_PRICING_INCOMPLETE_DEACTIVATE_WARNING } from './package-pricing/package-pricing.constants';
import { loadPricingCompletenessInput } from './package-pricing/package-pricing.service';

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

  /** Whether all required pricing cells are filled for activation. */
  async isPackagePricingComplete(packageId: number): Promise<boolean> {
    const input = await loadPricingCompletenessInput(this.prismaService, packageId);
    if (!input) return false;
    return evaluatePackagePricingCompleteness(input).isPricingComplete;
  }

  /**
   * When an active package becomes pricing-incomplete, deactivate and return a warning (US3).
   */
  async deactivateIfActiveAndPricingIncomplete(
    packageId: number,
    wasActive: boolean
  ): Promise<{ isActive: boolean; warning?: string }> {
    if (!wasActive) {
      const pkg = await this.prismaService.package.findUnique({
        where: { id: packageId },
        select: { isActive: true },
      });
      return { isActive: pkg?.isActive ?? false };
    }

    const complete = await this.isPackagePricingComplete(packageId);
    if (complete) {
      return { isActive: true };
    }

    await this.prismaService.package.update({
      where: { id: packageId },
      data: { isActive: false },
    });

    return {
      isActive: false,
      warning: PACKAGE_PRICING_INCOMPLETE_DEACTIVATE_WARNING,
    };
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

  async getPackages(correlationId: string, includeInactive = false) {
    this.logger.log(
      `[${correlationId}] Getting packages (includeInactive=${includeInactive})`,
    );

    try {
      const packages = await this.prismaService.package.findMany({
        where: includeInactive ? {} : { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          packagePaymentFrequencies: {
            select: { frequency: true, installmentCount: true },
            orderBy: { frequency: 'asc' },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      this.logger.log(`[${correlationId}] Found ${packages.length} packages`);
      return packages.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
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
   * Flat scheme list for pickers (includes inactive; UI disables inactive rows).
   */
  async listSchemesForPicker(correlationId: string) {
    this.logger.log(`[${correlationId}] Listing schemes for picker`);
    try {
      const schemes = await this.prismaService.scheme.findMany({
        select: {
          id: true,
          schemeName: true,
          isActive: true,
        },
        orderBy: { schemeName: 'asc' },
      });
      return schemes.map((s) => ({
        id: s.id,
        name: s.schemeName,
        isActive: s.isActive,
      }));
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error listing schemes for picker: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Packages linked to any of the given schemes (for campaign compose pickers).
   * Includes inactive packages; UI disables inactive rows.
   */
  async listPackagesForSchemes(schemeIds: number[], correlationId: string) {
    this.logger.log(
      `[${correlationId}] Listing packages for schemes [${schemeIds.join(',')}]`,
    );
    if (schemeIds.length === 0) return [];
    try {
      const rows = await this.prismaService.packageScheme.findMany({
        where: { schemeId: { in: schemeIds } },
        select: {
          package: {
            select: { id: true, name: true, isActive: true },
          },
        },
      });
      const byId = new Map<number, { id: number; name: string; isActive: boolean }>();
      for (const row of rows) {
        if (!row.package) continue;
        byId.set(row.package.id, {
          id: row.package.id,
          name: row.package.name,
          isActive: row.package.isActive,
        });
      }
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error listing packages for schemes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
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
              parentsSupported: true,
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
        parentsSupported: ps.scheme.parentsSupported,
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
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      const plansDto = plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description ?? undefined,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
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
      select: { id: true, isActive: true },
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
      const existingPlans = await this.prismaService.packagePlan.findMany({
        where: { packageId },
        select: { sortOrder: true },
      });
      const maxSort = existingPlans.reduce((m, p) => Math.max(m, p.sortOrder), -1);

      const plan = await this.prismaService.packagePlan.create({
        data: {
          packageId,
          name,
          description: trimOrNull(data.description ?? null),
          isActive: data.isActive ?? true,
          sortOrder: maxSort + 1,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      const deactivateResult = await this.deactivateIfActiveAndPricingIncomplete(
        packageId,
        packageExists.isActive
      );

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description ?? undefined,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        packageIsActive: deactivateResult.isActive,
        ...(deactivateResult.warning ? { warning: deactivateResult.warning } : {}),
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
    data: { name?: string; description?: string; isActive?: boolean },
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

    const validationErrors: Record<string, string> = {};

    let nextName: string | undefined;
    if (data.name !== undefined) {
      nextName = toTitleCase(data.name);
      if (!nextName) {
        validationErrors['name'] = 'Plan name is required';
      } else if (nextName.toLowerCase() !== plan.name.toLowerCase()) {
        const duplicate = await this.prismaService.packagePlan.findFirst({
          where: {
            packageId,
            name: { equals: nextName, mode: 'insensitive' },
            NOT: { id: planId },
          },
          select: { id: true },
        });
        if (duplicate) {
          validationErrors['name'] = 'A plan with this name already exists for this package';
        }
      }
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
        validationErrors['isActive'] =
          'Cannot deactivate the last active plan while the package is active';
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors);
    }

    try {
      const updated = await this.prismaService.packagePlan.update({
        where: { id: planId },
        data: {
          ...(nextName !== undefined && { name: nextName }),
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
        sortOrder: updated.sortOrder,
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

  /**
   * Persist display order for all plans in a package.
   * `planIds` must be a permutation of every plan ID for the package.
   */
  async reorderPackagePlans(
    packageId: number,
    planIds: number[],
    userId: string,
    correlationId: string
  ) {
    this.logger.log(
      `[${correlationId}] Reordering ${planIds.length} plans for package ${packageId}`
    );

    const packageExists = await this.prismaService.package.findUnique({
      where: { id: packageId },
      select: { id: true },
    });
    if (!packageExists) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    if (new Set(planIds).size !== planIds.length) {
      throw ValidationException.forField(
        'planIds',
        'Plan IDs must be unique',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const existing = await this.prismaService.packagePlan.findMany({
      where: { packageId },
      select: { id: true, name: true, description: true, isActive: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const existingIds = new Set(existing.map((p) => p.id));
    if (planIds.length !== existing.length || planIds.some((id) => !existingIds.has(id))) {
      throw ValidationException.forField(
        'planIds',
        'planIds must include every plan for this package exactly once',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    await this.prismaService.$transaction(
      planIds.map((id, index) =>
        this.prismaService.packagePlan.update({
          where: { id },
          data: { sortOrder: index, updatedBy: userId },
        })
      )
    );

    const byId = new Map(existing.map((p) => [p.id, p]));
    return planIds.map((id, index) => {
      const plan = byId.get(id)!;
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description ?? undefined,
        isActive: plan.isActive,
        sortOrder: index,
      };
    });
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
        parentsSupported: pkg.parentsSupported,
        maximumFamilySize: pkg.maximumFamilySize,
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
      parentsSupported?: boolean;
      maximumFamilySize?: number;
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

      if (data.maximumFamilySize !== undefined) {
        if (
          !Number.isInteger(data.maximumFamilySize) ||
          data.maximumFamilySize < 2 ||
          data.maximumFamilySize > 99
        ) {
          throw ValidationException.forField(
            'maximumFamilySize',
            'maximumFamilySize must be an integer between 2 and 99',
            ErrorCodes.VALIDATION_ERROR
          );
        }
        const upToNCategories = await this.prismaService.packagePricingCategory.findMany({
          where: { packageId, kind: PackagePricingCategoryKind.UP_TO_N },
          select: { key: true, maxMembers: true, displayName: true },
        });
        const blocking = upToNCategories.filter(
          (c) => c.maxMembers != null && c.maxMembers > data.maximumFamilySize!
        );
        if (blocking.length > 0) {
          const labels = blocking
            .map((c) => c.displayName || c.key || `Up to ${c.maxMembers}`)
            .join(', ');
          throw ValidationException.forField(
            'maximumFamilySize',
            `Cannot set maximumFamilySize below existing Up to N categories (${labels}). Remove or edit those categories first.`,
            ErrorCodes.VALIDATION_ERROR
          );
        }
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
        const pricingComplete = await this.isPackagePricingComplete(packageId);
        if (!pricingComplete) {
          throw ValidationException.forField(
            'isActive',
            'Package cannot be activated until pricing is complete',
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
            ...(data.parentsSupported !== undefined && {
              parentsSupported: data.parentsSupported,
            }),
            ...(data.maximumFamilySize !== undefined && {
              maximumFamilySize: data.maximumFamilySize,
            }),
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

        if (data.parentsSupported === false && existing.parentsSupported) {
          const linkedSchemeIds = (
            await tx.packageScheme.findMany({
              where: { packageId },
              select: { schemeId: true },
            })
          ).map((ps) => ps.schemeId);
          if (linkedSchemeIds.length > 0) {
            await tx.scheme.updateMany({
              where: { id: { in: linkedSchemeIds }, parentsSupported: true },
              data: { parentsSupported: false },
            });
          }
        }

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

      let packageIsActive = pkg.isActive;
      let warning: string | undefined;
      if (frequencies && existing.isActive) {
        const deactivateResult = await this.deactivateIfActiveAndPricingIncomplete(
          packageId,
          true
        );
        packageIsActive = deactivateResult.isActive;
        warning = deactivateResult.warning;
      }

      return {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        underwriterId: pkg.underwriterId,
        underwriterName: pkg.underwriter?.name ?? null,
        isActive: packageIsActive,
        parentsSupported: pkg.parentsSupported,
        maximumFamilySize: pkg.maximumFamilySize,
        logoPath: pkg.logoPath,
        paymentFrequencies: this.mapPaymentFrequencies(pkg.packagePaymentFrequencies),
        createdBy: pkg.createdBy,
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),
        ...(warning ? { warning } : {}),
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
        parentsSupported: scheme.parentsSupported,
        isPostpaid: scheme.isPostpaid,
        frequency: scheme.frequency,
        paymentCadence: scheme.paymentCadence,
        paymentAcNumber: scheme.paymentAcNumber,
        startDate: scheme.startDate?.toISOString() ?? null,
        endDate: scheme.endDate?.toISOString() ?? null,
        nominalPaymentPeriodEndDate:
          scheme.nominalPaymentPeriodEndDate?.toISOString() ?? null,
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
      parentsSupported?: boolean;
    },
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Updating scheme ${schemeId}`);

    try {
      // Verify scheme exists
      const existing = await this.prismaService.scheme.findUnique({
        where: { id: schemeId },
        include: {
          packageSchemes: {
            select: {
              package: { select: { parentsSupported: true } },
            },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Scheme with ID ${schemeId} not found`);
      }

      if (data.parentsSupported === true) {
        const packageAllowsParents = existing.packageSchemes.some(
          (ps) => ps.package.parentsSupported
        );
        if (!packageAllowsParents) {
          throw ValidationException.forField(
            'parentsSupported',
            'Cannot enable parentsSupported: none of the linked packages support parents',
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }

      const scheme = await this.prismaService.scheme.update({
        where: { id: schemeId },
        data: {
          ...(data.schemeName !== undefined && { schemeName: data.schemeName.trim() }),
          ...(data.description !== undefined && { description: data.description.trim() }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.parentsSupported !== undefined && {
            parentsSupported: data.parentsSupported,
          }),
        },
      });

      this.logger.log(`[${correlationId}] Updated scheme ${schemeId}`);

      return {
        id: scheme.id,
        schemeName: scheme.schemeName,
        description: scheme.description,
        isActive: scheme.isActive,
        parentsSupported: scheme.parentsSupported,
        isPostpaid: scheme.isPostpaid,
        frequency: scheme.frequency,
        paymentCadence: scheme.paymentCadence,
        paymentAcNumber: scheme.paymentAcNumber,
        startDate: scheme.startDate?.toISOString() ?? null,
        endDate: scheme.endDate?.toISOString() ?? null,
        nominalPaymentPeriodEndDate:
          scheme.nominalPaymentPeriodEndDate?.toISOString() ?? null,
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
            packageScheme: {
              select: {
                packageId: true,
              },
            },
            customer: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                phoneNumber: true,
                gender: true,
                createdAt: true,
                status: true,
                idNumber: true,
                hasMissingRequirements: true,
                policies: {
                  where: {
                    supersededByPolicyId: null,
                  },
                  select: {
                    status: true,
                    packageId: true,
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                },
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
      const customers = packageSchemeCustomers.map((psc) => {
        const currentPolicy = psc.customer.policies.find(
          (policy) => policy.packageId === psc.packageScheme.packageId
        );

        return {
          id: psc.customer.id,
          firstName: psc.customer.firstName,
          middleName: psc.customer.middleName ?? undefined,
          lastName: psc.customer.lastName,
          phoneNumber: psc.customer.phoneNumber,
          gender: psc.customer.gender?.toLowerCase() ?? 'unknown',
          createdAt: psc.customer.createdAt.toISOString(),
          customerStatus: psc.customer.status,
          policyStatus: currentPolicy?.status ?? null,
          idNumber: maskIdNumberOrEmpty(psc.customer.idNumber),
          hasMissingRequirements: psc.customer.hasMissingRequirements,
        };
      });

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
      parentsSupported?: boolean;
      maximumFamilySize: number;
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
      const maximumFamilySize = data.maximumFamilySize;

      if (!Number.isInteger(maximumFamilySize) || maximumFamilySize < 2 || maximumFamilySize > 99) {
        throw ValidationException.forField(
          'maximumFamilySize',
          'maximumFamilySize is required and must be an integer between 2 and 99',
          ErrorCodes.VALIDATION_ERROR
        );
      }

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

        await tx.packagePricingCategory.create({
          data: {
            packageId: created.id,
            key: 'member_only',
            displayName: 'M',
            kind: PackagePricingCategoryKind.MEMBER_ONLY,
            sortOrder: 0,
            createdBy: userId,
            updatedBy: userId,
          },
        });

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
        parentsSupported: pkg.parentsSupported,
        maximumFamilySize: pkg.maximumFamilySize,
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
      parentsSupported?: boolean;
      isPostpaid?: boolean;
      frequency?: PaymentFrequency;
      paymentCadence?: number;
      startDate?: string;
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
      let postpaidCoverage: ReturnType<typeof derivePostpaidSchemeCoverageDates> | null =
        null;
      let packageInstallmentCount: number | null = null;

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

        if (!data.startDate?.trim()) {
          validationErrors['startDate'] =
            'Policy start date is required for postpaid schemes';
        } else {
          const parsedStart = new Date(data.startDate);
          if (Number.isNaN(parsedStart.getTime())) {
            validationErrors['startDate'] = 'Policy start date must be a valid date';
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

        if (data.parentsSupported) {
          const pkgParents = await this.prismaService.package.findUnique({
            where: { id: data.packageId },
            select: { parentsSupported: true },
          });
          if (!pkgParents?.parentsSupported) {
            validationErrors['parentsSupported'] =
              'Cannot enable parentsSupported: the package does not support parents';
          }
        }

        if (data.isPostpaid && data.frequency && !validationErrors['frequency']) {
          const supported = await this.prismaService.packagePaymentFrequency.findUnique({
            where: {
              packageId_frequency: {
                packageId: data.packageId,
                frequency: data.frequency,
              },
            },
            select: { id: true, installmentCount: true },
          });
          if (!supported) {
            validationErrors['frequency'] =
              'Payment frequency is not supported for this package';
          } else if (supported.installmentCount <= 0) {
            validationErrors['frequency'] =
              'Package payment frequency installment count must be greater than zero';
          } else {
            packageInstallmentCount = supported.installmentCount;
          }
        }
      }

      if (
        data.isPostpaid &&
        !validationErrors['frequency'] &&
        !validationErrors['startDate'] &&
        data.startDate &&
        calculatedPaymentCadence &&
        packageInstallmentCount != null &&
        packageInstallmentCount > 0
      ) {
        postpaidCoverage = derivePostpaidSchemeCoverageDates({
          startDate: new Date(data.startDate),
          expectedInstallmentCount: packageInstallmentCount,
          paymentCadence: calculatedPaymentCadence,
        });
      } else if (
        data.isPostpaid &&
        data.packageId &&
        !validationErrors['frequency'] &&
        packageInstallmentCount == null
      ) {
        validationErrors['frequency'] =
          'Package payment frequency installment count is required to compute scheme dates';
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
              parentsSupported: data.parentsSupported ?? false,
              isPostpaid: data.isPostpaid ?? false,
              frequency: data.frequency ?? null,
              paymentCadence: calculatedPaymentCadence,
              paymentAcNumber: paymentAcNumber ?? null,
              startDate: postpaidCoverage?.startDate ?? null,
              endDate: postpaidCoverage?.endDate ?? null,
              nominalPaymentPeriodEndDate:
                postpaidCoverage?.nominalPaymentPeriodEndDate ?? null,
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
          parentsSupported: createdScheme!.parentsSupported,
          isPostpaid: createdScheme!.isPostpaid,
          frequency: createdScheme!.frequency,
          paymentCadence: createdScheme!.paymentCadence,
          paymentAcNumber: createdScheme!.paymentAcNumber,
          startDate: createdScheme!.startDate?.toISOString() ?? null,
          endDate: createdScheme!.endDate?.toISOString() ?? null,
          nominalPaymentPeriodEndDate:
            createdScheme!.nominalPaymentPeriodEndDate?.toISOString() ?? null,
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
            parentsSupported: data.parentsSupported ?? false,
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
          parentsSupported: scheme.parentsSupported,
          isPostpaid: scheme.isPostpaid,
          frequency: scheme.frequency,
          paymentCadence: scheme.paymentCadence,
          paymentAcNumber: scheme.paymentAcNumber,
          startDate: scheme.startDate?.toISOString() ?? null,
          endDate: scheme.endDate?.toISOString() ?? null,
          nominalPaymentPeriodEndDate:
            scheme.nominalPaymentPeriodEndDate?.toISOString() ?? null,
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

