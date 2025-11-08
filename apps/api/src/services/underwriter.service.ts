import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';

/**
 * Underwriter Service
 *
 * Handles business logic for underwriter management operations
 *
 * Features:
 * - Underwriter CRUD operations
 * - Package listing with counts for underwriters
 * - Pagination support
 */
@Injectable()
export class UnderwriterService {
  private readonly logger = new Logger(UnderwriterService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Get all underwriters with pagination
   * @param page - Page number (default: 1)
   * @param pageSize - Items per page (default: 20)
   * @param correlationId - Correlation ID for tracing
   * @returns Paginated list of underwriters
   */
  async getUnderwriters(
    page: number = 1,
    pageSize: number = 20,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Getting underwriters, page ${page}, pageSize ${pageSize}`);

    try {
      const validatedPage = Math.max(1, page);
      const validatedPageSize = Math.min(100, Math.max(1, pageSize));
      const skip = (validatedPage - 1) * validatedPageSize;

      const [underwriters, totalCount] = await Promise.all([
        this.prismaService.underwriter.findMany({
          skip,
          take: validatedPageSize,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            _count: {
              select: {
                packages: true,
              },
            },
          },
        }),
        this.prismaService.underwriter.count(),
      ]);

      const totalPages = Math.ceil(totalCount / validatedPageSize);

      const underwritersDto = underwriters.map((u) => ({
        id: u.id,
        name: u.name,
        shortName: u.shortName,
        website: u.website,
        officeLocation: u.officeLocation,
        isActive: u.isActive,
        logoPath: u.logoPath,
        createdBy: u.createdBy,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        packagesCount: u._count.packages,
      }));

      this.logger.log(`[${correlationId}] Found ${underwriters.length} underwriters`);

      return {
        data: underwritersDto,
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
        `[${correlationId}] Error getting underwriters: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get underwriter by ID
   * @param id - Underwriter ID
   * @param correlationId - Correlation ID for tracing
   * @returns Underwriter details
   */
  async getUnderwriterById(id: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting underwriter ${id}`);

    try {
      const underwriter = await this.prismaService.underwriter.findUnique({
        where: { id },
      });

      if (!underwriter) {
        throw new NotFoundException(`Underwriter with ID ${id} not found`);
      }

      return {
        id: underwriter.id,
        name: underwriter.name,
        shortName: underwriter.shortName,
        website: underwriter.website,
        officeLocation: underwriter.officeLocation,
        isActive: underwriter.isActive,
        logoPath: underwriter.logoPath,
        createdBy: underwriter.createdBy,
        createdAt: underwriter.createdAt.toISOString(),
        updatedAt: underwriter.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting underwriter ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Create a new underwriter
   * @param data - Underwriter creation data
   * @param userId - User ID who is creating the underwriter
   * @param correlationId - Correlation ID for tracing
   * @returns Created underwriter
   */
  async createUnderwriter(
    data: {
      name: string;
      shortName: string;
      website: string;
      officeLocation: string;
      logoPath?: string;
      isActive?: boolean;
    },
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Creating underwriter: ${data.name}`);

    try {
      // Pre-save validation: Check for duplicates
      const validationErrors: Record<string, string> = {};

      // Normalize website URL for comparison (remove protocol, trailing slash, lowercase)
      const normalizedWebsite = data.website
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');

      // Check if name already exists (case-insensitive)
      const existingByName = await this.prismaService.underwriter.findFirst({
        where: {
          name: {
            equals: data.name,
            mode: 'insensitive',
          },
        },
      });

      if (existingByName) {
        validationErrors['name'] = 'An underwriter with this name already exists';
      }

      // Check if shortName already exists (case-insensitive)
      const existingByShortName = await this.prismaService.underwriter.findFirst({
        where: {
          shortName: {
            equals: data.shortName,
            mode: 'insensitive',
          },
        },
      });

      if (existingByShortName) {
        validationErrors['shortName'] = 'An underwriter with this short name already exists';
      }

      // Check if website already exists (normalized comparison)
      // Get all underwriters (we'll filter for non-null websites in JavaScript)
      const allUnderwriters = await this.prismaService.underwriter.findMany({
        select: {
          website: true,
        },
      });

      const websiteExists = allUnderwriters.some(uw => {
        if (!uw.website) return false;
        const existingNormalized = uw.website
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '');
        return existingNormalized === normalizedWebsite;
      });

      if (websiteExists) {
        validationErrors['website'] = 'An underwriter with this website already exists';
      }

      // If there are any validation errors, throw exception with all errors
      if (Object.keys(validationErrors).length > 0) {
        throw ValidationException.withMultipleErrors(validationErrors, ErrorCodes.VALIDATION_ERROR);
      }

      const underwriter = await this.prismaService.underwriter.create({
        data: {
          name: data.name,
          shortName: data.shortName,
          website: data.website,
          officeLocation: data.officeLocation,
          logoPath: data.logoPath,
          isActive: data.isActive ?? false, // Default to false
          createdBy: userId,
        },
      });

      this.logger.log(`[${correlationId}] Created underwriter with ID ${underwriter.id}`);

      return {
        id: underwriter.id,
        name: underwriter.name,
        shortName: underwriter.shortName,
        website: underwriter.website,
        officeLocation: underwriter.officeLocation,
        isActive: underwriter.isActive,
        logoPath: underwriter.logoPath,
        createdBy: underwriter.createdBy,
        createdAt: underwriter.createdAt.toISOString(),
        updatedAt: underwriter.updatedAt.toISOString(),
      };
    } catch (error) {
      // Log full error details for debugging
      this.logger.error(
        `[${correlationId}] Error creating underwriter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );

      // Log Prisma error details if available
      if (error && typeof error === 'object' && 'meta' in error) {
        this.logger.error(
          `[${correlationId}] Prisma error meta: ${JSON.stringify((error as any).meta)}`
        );
      }

      // Re-throw with more context if it's a Prisma error
      if (error instanceof Error) {
        // Check for specific Prisma error patterns
        if (error.message.includes('Unique constraint failed')) {
          // Extract which field failed from meta if available
          const meta = (error as any).meta;
          if (meta?.target) {
            const fields = Array.isArray(meta.target) ? meta.target.join(', ') : String(meta.target);
            throw new Error(`A record with this ${fields} already exists`);
          }
          throw new Error('A record with this information already exists');
        }
        if (error.message.includes('Foreign key constraint failed')) {
          throw new Error('Invalid reference to related data');
        }
        if (error.message.includes('Null constraint')) {
          throw new Error('Required field is missing');
        }
      }

      throw error;
    }
  }

  /**
   * Update an underwriter
   * @param id - Underwriter ID
   * @param data - Underwriter update data
   * @param correlationId - Correlation ID for tracing
   * @returns Updated underwriter
   */
  async updateUnderwriter(
    id: number,
    data: {
      name?: string;
      shortName?: string;
      website?: string;
      officeLocation?: string;
      logoPath?: string;
      isActive?: boolean;
    },
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Updating underwriter ${id}`);

    try {
      // Verify underwriter exists
      const existing = await this.prismaService.underwriter.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Underwriter with ID ${id} not found`);
      }

      const underwriter = await this.prismaService.underwriter.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.shortName !== undefined && { shortName: data.shortName }),
          ...(data.website !== undefined && { website: data.website }),
          ...(data.officeLocation !== undefined && { officeLocation: data.officeLocation }),
          ...(data.logoPath !== undefined && { logoPath: data.logoPath }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      this.logger.log(`[${correlationId}] Updated underwriter ${id}`);

      return {
        id: underwriter.id,
        name: underwriter.name,
        shortName: underwriter.shortName,
        website: underwriter.website,
        officeLocation: underwriter.officeLocation,
        isActive: underwriter.isActive,
        logoPath: underwriter.logoPath,
        createdBy: underwriter.createdBy,
        createdAt: underwriter.createdAt.toISOString(),
        updatedAt: underwriter.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error updating underwriter ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get packages for an underwriter with counts
   * @param underwriterId - Underwriter ID
   * @param correlationId - Correlation ID for tracing
   * @returns List of packages with scheme counts and total customers
   */
  async getUnderwriterPackages(underwriterId: number, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting packages for underwriter ${underwriterId}`);

    try {
      // Verify underwriter exists
      const underwriter = await this.prismaService.underwriter.findUnique({
        where: { id: underwriterId },
        select: { id: true },
      });

      if (!underwriter) {
        throw new NotFoundException(`Underwriter with ID ${underwriterId} not found`);
      }

      // Get packages for this underwriter
      const packages = await this.prismaService.package.findMany({
        where: {
          underwriterId: underwriterId,
        },
        include: {
          packageSchemes: {
            include: {
              scheme: {
                select: {
                  id: true,
                },
              },
              packageSchemeCustomers: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Calculate counts for each package
      const packagesDto = packages.map((pkg) => {
        const schemesCount = pkg.packageSchemes.length;
        const totalCustomers = pkg.packageSchemes.reduce(
          (sum, ps) => sum + ps.packageSchemeCustomers.length,
          0
        );

        return {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description.length > 40 ? pkg.description.substring(0, 40) + '...' : pkg.description,
          fullDescription: pkg.description,
          schemesCount,
          totalCustomers,
        };
      });

      this.logger.log(`[${correlationId}] Found ${packagesDto.length} packages for underwriter ${underwriterId}`);

      return packagesDto;
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting packages for underwriter ${underwriterId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }
}

