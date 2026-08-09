import { ProductManagementService } from '../product-management.service';

describe('ProductManagementService picker lists', () => {
  let service: ProductManagementService;
  let prisma: {
    package: { findMany: jest.Mock };
    scheme: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      package: { findMany: jest.fn() },
      scheme: { findMany: jest.fn() },
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
      { id: 1, name: 'A', isActive: true },
      { id: 2, name: 'B', isActive: false },
    ]);
  });
});
