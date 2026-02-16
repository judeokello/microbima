import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MessagingTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(where?: Prisma.MessagingTemplateWhereInput) {
    return this.prisma.messagingTemplate.findMany({
      where,
      orderBy: [{ templateKey: 'asc' }, { channel: 'asc' }, { language: 'asc' }],
    });
  }

  async create(data: Prisma.MessagingTemplateCreateInput) {
    return this.prisma.messagingTemplate.create({ data });
  }

  async update(id: string, data: Prisma.MessagingTemplateUpdateInput) {
    return this.prisma.messagingTemplate.update({ where: { id }, data });
  }

  async getById(id: string) {
    return this.prisma.messagingTemplate.findUnique({ where: { id } });
  }
}

