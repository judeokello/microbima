import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
 */
@Injectable()
export class ProductManagementService {
  private readonly logger = new Logger(ProductManagementService.name);

  constructor(private readonly prismaService: PrismaService) {}

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
}

