import { ProductManagementService } from '../product-management.service';

describe('ProductManagementService picker lists', () => {
  let service: ProductManagementService;
  let prisma: {
    package: { findMany: jest.Mock };
    scheme: { findMany: jest.Mock };
    packageScheme: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      package: { findMany: jest.fn() },
      scheme: { findMany: jest.fn() },
      packageScheme: { findMany: jest.fn() },
    };
    service = new ProductManagementService(prisma as never, {} as never, {} as never);
  });

  it('getPackages defaults to active-only', async () => {
    prisma.package.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'ActivePkg',
        slug: 'a',
        isActive: true,
        packagePaymentFrequencies: [],
      },
    ]);
    await service.getPackages('corr');
    expect(prisma.package.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('getPackages includeInactive=true returns active and inactive', async () => {
    prisma.package.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'ActivePkg',
        slug: 'a',
        isActive: true,
        packagePaymentFrequencies: [],
      },
      {
        id: 2,
        name: 'InactivePkg',
        slug: 'b',
        isActive: false,
        packagePaymentFrequencies: [],
      },
    ]);
    const result = await service.getPackages('corr', true);
    expect(prisma.package.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.isActive)).toEqual([true, false]);
  });

  it('listSchemesForPicker returns all schemes with isActive', async () => {
    prisma.scheme.findMany.mockResolvedValue([
      { id: 1, schemeName: 'A', isActive: true },
      { id: 2, schemeName: 'B', isActive: false },
    ]);
    const result = await service.listSchemesForPicker('corr');
    expect(result).toEqual([
      { id: 1, name: 'A', isActive: true, parentsSupported: undefined, isPostpaid: undefined },
      { id: 2, name: 'B', isActive: false, parentsSupported: undefined, isPostpaid: undefined },
    ]);
  });

  it('listSchemesForPicker prefix-searches when q has at least 2 letters', async () => {
    prisma.scheme.findMany.mockResolvedValue([{ id: 3, schemeName: 'Ood Drivers', isActive: true }]);
    await service.listSchemesForPicker('corr', 'Oo');
    expect(prisma.scheme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schemeName: { startsWith: 'Oo', mode: 'insensitive' } },
      }),
    );
  });

  it('listSchemesForPicker returns empty when q is a single letter', async () => {
    const result = await service.listSchemesForPicker('corr', 'O');
    expect(result).toEqual([]);
    expect(prisma.scheme.findMany).not.toHaveBeenCalled();
  });

  it('listPackagesForSchemes returns distinct packages for scheme ids', async () => {
    prisma.packageScheme.findMany.mockResolvedValue([
      {
        id: 1,
        package: { id: 10, name: 'Pkg A', slug: 'a', isActive: true, parentsSupported: false },
        scheme: { isPostpaid: false, parentsSupported: false },
      },
      {
        id: 1,
        package: { id: 10, name: 'Pkg A', slug: 'a', isActive: true, parentsSupported: false },
        scheme: { isPostpaid: false, parentsSupported: false },
      },
      {
        id: 2,
        package: { id: 11, name: 'Pkg B', slug: 'b', isActive: false, parentsSupported: true },
        scheme: { isPostpaid: true, parentsSupported: true },
      },
    ]);
    const result = await service.listPackagesForSchemes([1, 2], 'corr');
    expect(prisma.packageScheme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schemeId: { in: [1, 2] } } }),
    );
    expect(result).toEqual([
      {
        id: 10,
        name: 'Pkg A',
        isActive: true,
        slug: 'a',
        parentsSupported: false,
        isPostpaid: false,
        packageSchemeId: 1,
      },
      {
        id: 11,
        name: 'Pkg B',
        isActive: false,
        slug: 'b',
        parentsSupported: true,
        isPostpaid: true,
        packageSchemeId: 2,
      },
    ]);
  });
});
