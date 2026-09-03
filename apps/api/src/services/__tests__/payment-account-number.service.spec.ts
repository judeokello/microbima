/// <reference types="jest" />
import { PaymentAccountNumberService } from '../payment-account-number.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PaymentAccountNumberService generateForPolicy', () => {
  const prisma = {} as PrismaService;
  const service = new PaymentAccountNumberService(prisma);

  const makeTx = () => ({
    customer: { findUnique: jest.fn() },
    policy: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('steals idNumber from EXPIRED/DEACTIVATED/INACTIVE when none occupy', async () => {
    const tx = makeTx();
    tx.customer.findUnique.mockResolvedValue({ idNumber: '12345678' });
    tx.policy.count.mockResolvedValue(0);
    tx.policy.updateMany.mockResolvedValue({ count: 2 });

    const pan = await service.generateForPolicy('cust-1', tx as never, 'corr');

    expect(pan).toBe('12345678');
    expect(tx.policy.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentAcNumber: '12345678',
          status: { in: ['EXPIRED', 'DEACTIVATED', 'INACTIVE'] },
        }),
        data: { paymentAcNumber: null },
      })
    );
  });

  it('suffixes when an occupying policy already exists', async () => {
    const tx = makeTx();
    tx.customer.findUnique.mockResolvedValue({ idNumber: '12345678' });
    tx.policy.count.mockResolvedValue(1);
    tx.policy.findMany.mockResolvedValue([{ paymentAcNumber: '12345678' }]);

    const pan = await service.generateForPolicy('cust-1', tx as never, 'corr');

    expect(pan).toBe('12345678B');
    expect(tx.policy.updateMany).not.toHaveBeenCalled();
  });

  it('never reuses an existing suffix for a second occupying policy', async () => {
    const tx = makeTx();
    tx.customer.findUnique.mockResolvedValue({ idNumber: '12345678' });
    tx.policy.count.mockResolvedValue(2);
    tx.policy.findMany.mockResolvedValue([
      { paymentAcNumber: '12345678' },
      { paymentAcNumber: '12345678B' },
    ]);

    const pan = await service.generateForPolicy('cust-1', tx as never, 'corr');
    expect(pan).toBe('12345678C');
    expect(pan).not.toBe('12345678');
    expect(pan).not.toBe('12345678B');
  });
});
