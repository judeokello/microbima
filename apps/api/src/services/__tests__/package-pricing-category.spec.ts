/// <reference types="jest" />
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
});
