/// <reference types="jest" />
import { NotFoundException } from '@nestjs/common';
import { PackagePricingCategoryKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagePricingService } from '../package-pricing/package-pricing.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { PackagePricingCategoryKindDto } from '../../dto/packages/package-pricing.dto';

describe('PackagePricingService - createCategory uniqueness', () => {
  const prismaMock = {
    package: {
      findUnique: jest.fn(),
    },
    packagePricingCategory: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new PackagePricingService(prismaMock as unknown as PrismaService);

  let loadedPackage = {
    id: 10,
    slug: 'test',
    isActive: false,
    packagePaymentFrequencies: [] as unknown[],
    packagePricingCategories: [] as unknown[],
    packagePlans: [] as unknown[],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loadedPackage = {
      id: 10,
      slug: 'test',
      isActive: false,
      packagePaymentFrequencies: [],
      packagePricingCategories: [],
      packagePlans: [],
    };
    prismaMock.package.findUnique.mockImplementation(
      (args?: { include?: unknown; where?: { id?: number } }) => {
        if (args?.include) {
          return Promise.resolve(loadedPackage);
        }
        return Promise.resolve({ id: 10, isActive: false });
      }
    );
  });

  it('rejects second MEMBER_ONLY category', async () => {
    prismaMock.packagePricingCategory.findMany.mockResolvedValue([
      {
        id: 1,
        key: 'member_only',
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        maxMembers: null,
        sortOrder: 0,
      },
    ]);

    await expect(
      service.createCategory(
        10,
        { kind: PackagePricingCategoryKindDto.MEMBER_ONLY, display: 'M2' },
        'user-1'
      )
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('rejects duplicate UP_TO_N maxMembers', async () => {
    prismaMock.packagePricingCategory.findMany.mockResolvedValue([
      {
        id: 1,
        key: 'member_only',
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        maxMembers: null,
        sortOrder: 0,
      },
      {
        id: 2,
        key: 'up_to_5',
        kind: PackagePricingCategoryKind.UP_TO_N,
        maxMembers: 5,
        sortOrder: 1,
      },
    ]);

    await expect(
      service.createCategory(
        10,
        { kind: PackagePricingCategoryKindDto.UP_TO_N, display: 'M(5) dup', maxMembers: 5 },
        'user-1'
      )
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('rejects second ADDITIONAL_SPOUSE category', async () => {
    prismaMock.packagePricingCategory.findMany.mockResolvedValue([
      {
        id: 1,
        key: 'member_only',
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        maxMembers: null,
        sortOrder: 0,
      },
      {
        id: 2,
        key: 'additional_spouse',
        kind: PackagePricingCategoryKind.ADDITIONAL_SPOUSE,
        maxMembers: null,
        sortOrder: 1,
      },
    ]);

    await expect(
      service.createCategory(
        10,
        { kind: PackagePricingCategoryKindDto.ADDITIONAL_SPOUSE, display: 'Spouse 2' },
        'user-1'
      )
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('creates UP_TO_N with derived key', async () => {
    prismaMock.packagePricingCategory.findMany.mockResolvedValue([
      {
        id: 1,
        key: 'member_only',
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        maxMembers: null,
        sortOrder: 0,
      },
    ]);
    prismaMock.packagePricingCategory.create.mockResolvedValue({
      id: 2,
      key: 'up_to_5',
      displayName: 'M(5)',
      kind: PackagePricingCategoryKind.UP_TO_N,
      maxMembers: 5,
      sortOrder: 1,
    });

    loadedPackage.packagePricingCategories = [
      {
        id: 1,
        key: 'member_only',
        displayName: 'M',
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        maxMembers: null,
        sortOrder: 0,
      },
      {
        id: 2,
        key: 'up_to_5',
        displayName: 'M(5)',
        kind: PackagePricingCategoryKind.UP_TO_N,
        maxMembers: 5,
        sortOrder: 1,
      },
    ];

    const result = await service.createCategory(
      10,
      { kind: PackagePricingCategoryKindDto.UP_TO_N, display: 'M(5)', maxMembers: 5 },
      'user-1'
    );

    expect(prismaMock.packagePricingCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key: 'up_to_5', maxMembers: 5 }),
      })
    );
    expect(result.category.key).toBe('up_to_5');
  });

  it('creates MEMBER_ONLY when none exists', async () => {
    prismaMock.packagePricingCategory.findMany.mockResolvedValue([]);
    prismaMock.packagePricingCategory.create.mockResolvedValue({
      id: 43,
      key: 'member_only',
      displayName: 'M',
      kind: PackagePricingCategoryKind.MEMBER_ONLY,
      maxMembers: null,
      sortOrder: 0,
    });
    loadedPackage.packagePricingCategories = [
      {
        id: 43,
        key: 'member_only',
        displayName: 'M',
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        maxMembers: null,
        sortOrder: 0,
      },
    ];

    const result = await service.createCategory(
      10,
      { kind: PackagePricingCategoryKindDto.MEMBER_ONLY, display: 'M' },
      'user-1'
    );

    expect(prismaMock.packagePricingCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'member_only',
          kind: PackagePricingCategoryKind.MEMBER_ONLY,
          maxMembers: null,
        }),
      })
    );
    expect(result.category.key).toBe('member_only');
  });
});

describe('PackagePricingService.convertCategoryToMemberOnly', () => {
  const prismaMock = {
    package: {
      findUnique: jest.fn(),
    },
    packagePricingCategory: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new PackagePricingService(prismaMock as unknown as PrismaService);

  const upToTwo = {
    id: 43,
    key: 'up_to_2',
    displayName: 'M',
    kind: PackagePricingCategoryKind.UP_TO_N,
    maxMembers: 2,
    sortOrder: 0,
  };

  let loadedPackage: {
    id: number;
    slug: string;
    isActive: boolean;
    maximumFamilySize: number;
    packagePaymentFrequencies: unknown[];
    packagePricingCategories: unknown[];
    packagePlans: unknown[];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loadedPackage = {
      id: 5,
      slug: 'mfanisi-tuktuk',
      isActive: false,
      maximumFamilySize: 8,
      packagePaymentFrequencies: [],
      packagePricingCategories: [upToTwo],
      packagePlans: [],
    };
    prismaMock.package.findUnique.mockImplementation(() => Promise.resolve(loadedPackage));
    prismaMock.packagePricingCategory.update.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        const converted = {
          ...upToTwo,
          ...args.data,
        };
        loadedPackage.packagePricingCategories = [converted];
        return converted;
      }
    );
  });

  it('flips kind, key, and maxMembers in place', async () => {
    const result = await service.convertCategoryToMemberOnly(5, 43, 'user-1');

    expect(prismaMock.packagePricingCategory.update).toHaveBeenCalledWith({
      where: { id: 43 },
      data: {
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        key: 'member_only',
        maxMembers: null,
        displayName: 'M',
        updatedBy: 'user-1',
      },
    });
    expect(result.categories.some((c) => c.kind === 'MEMBER_ONLY' && c.key === 'member_only')).toBe(
      true
    );
    expect(result.isPricingComplete).toBe(false);
  });

  it('rejects converting Additional spouse', async () => {
    loadedPackage.packagePricingCategories = [
      {
        id: 46,
        key: 'additional_spouse',
        displayName: 'Additional spouse',
        kind: PackagePricingCategoryKind.ADDITIONAL_SPOUSE,
        maxMembers: null,
        sortOrder: 1,
      },
    ];

    await expect(service.convertCategoryToMemberOnly(5, 46, 'user-1')).rejects.toBeInstanceOf(
      ValidationException
    );
    expect(prismaMock.packagePricingCategory.update).not.toHaveBeenCalled();
  });

  it('rejects when Member only already exists', async () => {
    loadedPackage.packagePricingCategories = [
      {
        id: 1,
        key: 'member_only',
        displayName: 'M',
        kind: PackagePricingCategoryKind.MEMBER_ONLY,
        maxMembers: null,
        sortOrder: 0,
      },
      upToTwo,
    ];

    await expect(service.convertCategoryToMemberOnly(5, 43, 'user-1')).rejects.toBeInstanceOf(
      ValidationException
    );
    expect(prismaMock.packagePricingCategory.update).not.toHaveBeenCalled();
  });

  it('throws when category is not on the package', async () => {
    await expect(service.convertCategoryToMemberOnly(5, 999, 'user-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
