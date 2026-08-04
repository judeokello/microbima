import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HealthcareProviderService } from '../healthcare-provider.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthcareProviderService', () => {
  const prismaMock = {
    package: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    packageProvider: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const service = new HealthcareProviderService(
    prismaMock as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listPackagePanels', () => {
    it('returns packages with provider counts', async () => {
      prismaMock.package.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'MfanisiGo',
          slug: 'mfanisi-go',
          _count: { packageProviders: 789 },
        },
        {
          id: 2,
          name: 'MfanisiBoda',
          slug: 'mfanisi-boda',
          _count: { packageProviders: 0 },
        },
      ]);

      const result = await service.listPackagePanels('corr-1');

      expect(prismaMock.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
      );
      expect(result).toEqual([
        {
          packageId: 1,
          packageName: 'MfanisiGo',
          packageSlug: 'mfanisi-go',
          providerCount: 789,
        },
        {
          packageId: 2,
          packageName: 'MfanisiBoda',
          packageSlug: 'mfanisi-boda',
          providerCount: 0,
        },
      ]);
    });
  });

  describe('listPackageProviders', () => {
    it('throws NotFoundException when package missing', async () => {
      prismaMock.package.findUnique.mockResolvedValue(null);

      await expect(
        service.listPackageProviders(99, 1, 20, undefined, 'corr-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns paginated providers and applies name search', async () => {
      prismaMock.package.findUnique.mockResolvedValue({
        id: 1,
        name: 'MfanisiGo',
        isActive: true,
      });
      prismaMock.packageProvider.findMany.mockResolvedValue([
        {
          healthcareProvider: {
            id: 10,
            name: 'BLISS GVS HEALTHCARE - KABARNET',
            countyId: 30,
            subCountyId: null,
            latitude: null,
            longitude: null,
            isActive: true,
            county: { id: 30, name: 'Baringo' },
            subCounty: null,
            source: { name: 'LCT Africa' },
          },
        },
      ]);
      prismaMock.packageProvider.count.mockResolvedValue(1);

      const result = await service.listPackageProviders(
        1,
        1,
        20,
        'bliss',
        'corr-1',
      );

      expect(prismaMock.packageProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          where: expect.objectContaining({
            packageId: 1,
            isActive: true,
            healthcareProvider: expect.objectContaining({
              isActive: true,
              name: { contains: 'bliss', mode: 'insensitive' },
            }),
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toContain('BLISS');
      expect(result.data[0].subCountyId).toBeNull();
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('lazy-loads later pages with skip based on page', async () => {
      prismaMock.package.findUnique.mockResolvedValue({
        id: 1,
        name: 'MfanisiGo',
        isActive: true,
      });
      prismaMock.packageProvider.findMany.mockResolvedValue([]);
      prismaMock.packageProvider.count.mockResolvedValue(45);

      const result = await service.listPackageProviders(
        1,
        3,
        20,
        undefined,
        'corr-1',
      );

      expect(prismaMock.packageProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasPreviousPage).toBe(true);
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });

  describe('exportPackageProvidersCsv', () => {
    it('builds CSV with header and provider rows', async () => {
      prismaMock.package.findUnique.mockResolvedValue({
        id: 1,
        name: 'MfanisiGo',
        slug: 'mfanisi-go',
        isActive: true,
      });
      prismaMock.packageProvider.findMany.mockResolvedValue([
        {
          healthcareProvider: {
            name: 'Test Hospital, Nairobi',
            latitude: new Prisma.Decimal('1.2345678'),
            longitude: new Prisma.Decimal('36.7654321'),
            county: { name: 'Nairobi City' },
            subCounty: null,
            source: { name: 'LCT Africa' },
          },
        },
      ]);

      const { filename, buffer } = await service.exportPackageProvidersCsv(
        1,
        'corr-1',
      );

      expect(filename).toBe('mfanisi-go-provider-panel.csv');
      const csv = buffer.toString('utf-8');
      expect(csv.split('\n')[0]).toBe(
        'Provider Name,County,Sub-County,Latitude,Longitude,Source',
      );
      expect(csv).toContain('"Test Hospital, Nairobi"');
      expect(csv).toContain('Nairobi City');
      expect(csv).toContain('1.2345678');
      expect(csv).toContain('LCT Africa');
    });
  });
});
