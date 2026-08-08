import { MessagingTemplatesService } from '../messaging-templates.service';
import { ValidationException } from '../../../exceptions/validation.exception';

describe('MessagingTemplatesService admin shells (US6)', () => {
  let service: MessagingTemplatesService;
  let prisma: {
    messagingTemplate: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      messagingTemplate: {
        findMany: jest.fn().mockResolvedValue([
          { id: '1', templateKey: 'customer_created' },
          { id: '2', templateKey: 'policy_purchase' },
        ]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: '1', body: 'updated' }),
      },
    };
    service = new MessagingTemplatesService(prisma as never);
  });

  it('list with excludeAdminCampaignShells=true omits admin shells', async () => {
    await service.list({}, { excludeAdminCampaignShells: true });
    expect(prisma.messagingTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              templateKey: {
                notIn: ['admin_template_sms', 'admin_template_email'],
              },
            },
          ],
        },
      }),
    );
  });

  it('PATCH updates non-admin template body', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: '1',
      templateKey: 'customer_created',
    });
    const updated = await service.update('1', { body: 'Hi {first_name}' });
    expect(updated.body).toBe('updated');
    expect(prisma.messagingTemplate.update).toHaveBeenCalled();
  });

  it('rejects PATCH on admin campaign shells', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      id: 'shell',
      templateKey: 'admin_template_sms',
    });
    await expect(service.update('shell', { body: 'x' })).rejects.toBeInstanceOf(ValidationException);
    expect(prisma.messagingTemplate.update).not.toHaveBeenCalled();
  });
});
