import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  HealthcareProviderListItemDto,
  PackageProviderPanelSummaryDto,
} from '../dto/healthcare-providers/healthcare-provider.dto';

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Healthcare provider panels for packages (agent-facing).
 */
@Injectable()
export class HealthcareProviderService {
  private readonly logger = new Logger(HealthcareProviderService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * List packages with active provider panel counts.
   */
  async listPackagePanels(correlationId: string): Promise<PackageProviderPanelSummaryDto[]> {
    this.logger.log(`[${correlationId}] Listing package provider panels`);

    const packages = await this.prismaService.package.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            packageProviders: {
              where: {
                isActive: true,
                healthcareProvider: { isActive: true },
              },
            },
          },
        },
      },
    });

    return packages.map((pkg) => ({
      packageId: pkg.id,
      packageName: pkg.name,
      packageSlug: pkg.slug,
      providerCount: pkg._count.packageProviders,
    }));
  }

  /**
   * Paginated providers for a package panel, optional name search.
   */
  async listPackageProviders(
    packageId: number,
    page: number = 1,
    pageSize: number = 20,
    search: string | undefined,
    correlationId: string,
  ) {
    this.logger.log(
      `[${correlationId}] Listing providers for package ${packageId}, page=${page}, search=${search ?? ''}`,
    );

    const pkg = await this.prismaService.package.findUnique({
      where: { id: packageId },
      select: { id: true, name: true, isActive: true },
    });

    if (!pkg || !pkg.isActive) {
      throw new NotFoundException(`Package ${packageId} not found`);
    }

    const validatedPage = Math.max(1, page);
    const validatedPageSize = Math.min(100, Math.max(1, pageSize));
    const skip = (validatedPage - 1) * validatedPageSize;
    const trimmedSearch = search?.trim();

    const where: Prisma.PackageProviderWhereInput = {
      packageId,
      isActive: true,
      healthcareProvider: {
        isActive: true,
        ...(trimmedSearch
          ? {
              name: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            }
          : {}),
      },
    };

    const [rows, totalItems] = await Promise.all([
      this.prismaService.packageProvider.findMany({
        where,
        skip,
        take: validatedPageSize,
        orderBy: {
          healthcareProvider: { name: 'asc' },
        },
        include: {
          healthcareProvider: {
            include: {
              county: { select: { id: true, name: true } },
              subCounty: { select: { id: true, name: true } },
              source: { select: { name: true } },
            },
          },
        },
      }),
      this.prismaService.packageProvider.count({ where }),
    ]);

    const data: HealthcareProviderListItemDto[] = rows.map((row) => {
      const p = row.healthcareProvider;
      return {
        id: p.id,
        name: p.name,
        countyId: p.countyId,
        countyName: p.county.name,
        subCountyId: p.subCountyId,
        subCountyName: p.subCounty?.name ?? null,
        latitude: decimalToNumber(p.latitude),
        longitude: decimalToNumber(p.longitude),
        sourceName: p.source.name,
        isActive: p.isActive,
      };
    });

    const totalPages = Math.ceil(totalItems / validatedPageSize) || 0;

    return {
      package: { id: pkg.id, name: pkg.name },
      data,
      pagination: {
        page: validatedPage,
        pageSize: validatedPageSize,
        totalItems,
        totalPages,
        hasNextPage: validatedPage < totalPages,
        hasPreviousPage: validatedPage > 1,
      },
    };
  }

  /**
   * Build CSV export for a package provider panel.
   */
  async exportPackageProvidersCsv(
    packageId: number,
    correlationId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    this.logger.log(`[${correlationId}] Exporting providers CSV for package ${packageId}`);

    const pkg = await this.prismaService.package.findUnique({
      where: { id: packageId },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    if (!pkg || !pkg.isActive) {
      throw new NotFoundException(`Package ${packageId} not found`);
    }

    const rows = await this.prismaService.packageProvider.findMany({
      where: {
        packageId,
        isActive: true,
        healthcareProvider: { isActive: true },
      },
      orderBy: {
        healthcareProvider: { name: 'asc' },
      },
      include: {
        healthcareProvider: {
          include: {
            county: { select: { name: true } },
            subCounty: { select: { name: true } },
            source: { select: { name: true } },
          },
        },
      },
    });

    const header = [
      'Provider Name',
      'County',
      'Sub-County',
      'Latitude',
      'Longitude',
      'Source',
    ];

    const lines = [header.join(',')];
    for (const row of rows) {
      const p = row.healthcareProvider;
      lines.push(
        [
          escapeCsvField(p.name),
          escapeCsvField(p.county.name),
          escapeCsvField(p.subCounty?.name ?? ''),
          escapeCsvField(decimalToNumber(p.latitude)),
          escapeCsvField(decimalToNumber(p.longitude)),
          escapeCsvField(p.source.name),
        ].join(','),
      );
    }

    const slug = pkg.slug?.trim() ?? `package-${pkg.id}`;
    const filename = `${slug}-provider-panel.csv`;
    return { filename, buffer: Buffer.from(lines.join('\n'), 'utf-8') };
  }
}
