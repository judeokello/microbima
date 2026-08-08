import { ForbiddenException } from '@nestjs/common';
import { MessagingCampaignsController } from '../../../../controllers/internal/messaging-campaigns.controller';
import { CampaignService } from '../campaign.service';
import { AuthenticatedUser } from '../../../../types/express';

describe('MessagingCampaignsController RBAC (US5)', () => {
  let controller: MessagingCampaignsController;
  let campaignService: jest.Mocked<
    Pick<CampaignService, 'preview' | 'create' | 'list' | 'getById' | 'cancel' | 'getCsv'>
  >;

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    roles: ['registration_admin'],
  } as AuthenticatedUser;

  const care: AuthenticatedUser = {
    id: 'care-1',
    roles: ['customer_care'],
  } as AuthenticatedUser;

  beforeEach(() => {
    campaignService = {
      preview: jest.fn().mockResolvedValue({ sendableCount: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'c1', status: 'DELAYED' }),
      list: jest.fn().mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 }),
      getById: jest.fn().mockResolvedValue({ id: 'c1' }),
      cancel: jest.fn().mockResolvedValue({ id: 'c1', status: 'CANCELLED' }),
      getCsv: jest.fn().mockResolvedValue('customerName,phone,email,customerId,error\n'),
    };
    controller = new MessagingCampaignsController(campaignService as unknown as CampaignService);
  });

  it('allows customer_care GET list/detail/CSV', async () => {
    await expect(controller.list(care)).resolves.toBeDefined();
    await expect(controller.get(care, 'c1')).resolves.toBeDefined();
    const res = { set: jest.fn() } as never;
    await expect(controller.errorsCsv(care, 'c1', res)).resolves.toBeDefined();
    await expect(controller.skipsCsv(care, 'c1', res)).resolves.toBeDefined();
  });

  it('forbids customer_care POST preview/create/cancel', async () => {
    await expect(controller.preview(care, {} as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.create(care, {} as never, undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(controller.cancel(care, 'c1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin preview/create/cancel', async () => {
    await expect(controller.preview(admin, {} as never)).resolves.toBeDefined();
    await expect(controller.create(admin, {} as never, undefined)).resolves.toBeDefined();
    await expect(controller.cancel(admin, 'c1')).resolves.toBeDefined();
  });
});
