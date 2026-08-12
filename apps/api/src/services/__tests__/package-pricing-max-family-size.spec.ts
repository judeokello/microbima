/// <reference types="jest" />
import { PackagePricingCategoryKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PackagePricingService } from '../package-pricing/package-pricing.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { PackagePricingCategoryKindDto } from '../../dto/packages/package-pricing.dto';

describe('PackagePricingService.createCategory — maximumFamilySize', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects UP_TO_N when maxMembers exceeds package maximumFamilySize', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 10,
      isActive: false,
      maximumFamilySize: 6,
    });
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
        {
          kind: PackagePricingCategoryKindDto.UP_TO_N,
          display: 'M(8)',
          maxMembers: 8,
        },
        'user-1'
      )
    ).rejects.toBeInstanceOf(ValidationException);

    expect(prismaMock.packagePricingCategory.create).not.toHaveBeenCalled();
  });
});
