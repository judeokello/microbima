import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      this.logger.error(
        `[${correlationId}] Error creating underwriter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
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

