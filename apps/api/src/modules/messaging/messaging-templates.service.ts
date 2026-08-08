import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ValidationException } from '../../exceptions/validation.exception';
import {
  ADMIN_TEMPLATE_EMAIL,
  ADMIN_TEMPLATE_SMS,
} from './campaigns/campaign.types';

export const ADMIN_CAMPAIGN_SHELL_KEYS = [ADMIN_TEMPLATE_SMS, ADMIN_TEMPLATE_EMAIL] as const;

@Injectable()
export class MessagingTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    where?: Prisma.MessagingTemplateWhereInput,
    options?: { excludeAdminCampaignShells?: boolean },
  ) {
    const clauses: Prisma.MessagingTemplateWhereInput[] = [];
    if (where && Object.keys(where).length > 0) clauses.push(where);
    if (options?.excludeAdminCampaignShells) {
      clauses.push({ templateKey: { notIn: [...ADMIN_CAMPAIGN_SHELL_KEYS] } });
    }
    return this.prisma.messagingTemplate.findMany({
      where: clauses.length > 0 ? { AND: clauses } : undefined,
      orderBy: [{ templateKey: 'asc' }, { channel: 'asc' }, { language: 'asc' }],
    });
  }

  async create(data: Prisma.MessagingTemplateCreateInput) {
    return this.prisma.messagingTemplate.create({ data });
  }

  async update(id: string, data: Prisma.MessagingTemplateUpdateInput) {
    const existing = await this.getById(id);
    if (existing && ADMIN_CAMPAIGN_SHELL_KEYS.includes(existing.templateKey as typeof ADMIN_CAMPAIGN_SHELL_KEYS[number])) {
      throw ValidationException.forField(
        'templateKey',
        'Admin campaign shells are not editable via Templates; compose campaigns separately',
      );
    }
    return this.prisma.messagingTemplate.update({ where: { id }, data });
  }

  async getById(id: string) {
    return this.prisma.messagingTemplate.findUnique({ where: { id } });
  }

  isAdminCampaignShell(templateKey: string): boolean {
    return (ADMIN_CAMPAIGN_SHELL_KEYS as readonly string[]).includes(templateKey);
  }
}

