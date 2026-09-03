/// <reference types="jest" />
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PolicyStatus } from '@prisma/client';

describe('PaymentAccountNumberService.generateForPolicy', () => {
  const service = new PaymentAccountNumberService({} as PrismaService);

  function txMock(params: { occupyingCount: number; idNumber?: string }) {
    return {
      customer: {
        findUnique: jest.fn().mockResolvedValue({ idNumber: params.idNumber ?? '12345678' }),
      },
      policy: {
        count: jest.fn().mockResolvedValue(params.occupyingCount),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
  }

  it('uses the id number and steals it from expired policies when none occupy', async () => {
    const tx = txMock({ occupyingCount: 0 });
    const result = await service.generateForPolicy('cust-1', true, tx as never, 'corr');
    expect(result).toBe('12345678');
    expect(tx.policy.updateMany).toHaveBeenCalledWith({
      where: {
        customerId: 'cust-1',
        paymentAcNumber: '12345678',
        status: {
          in: [PolicyStatus.EXPIRED, PolicyStatus.DEACTIVATED, PolicyStatus.INACTIVE],
        },
      },
      data: { paymentAcNumber: null },
    });
  });

  it('suffixes B for the second occupying policy', async () => {
    const tx = txMock({ occupyingCount: 1 });
    const result = await service.generateForPolicy('cust-1', false, tx as never, 'corr');
    expect(result).toBe('12345678B');
  });

  it('suffixes C for the third occupying policy', async () => {
    const tx = txMock({ occupyingCount: 2 });
    const result = await service.generateForPolicy('cust-1', false, tx as never, 'corr');
    expect(result).toBe('12345678C');
  });
});
