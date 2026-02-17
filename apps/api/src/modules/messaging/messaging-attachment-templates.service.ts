import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MessagingAttachmentTemplateType } from '@prisma/client';

@Injectable()
export class MessagingAttachmentTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(where?: Prisma.MessagingAttachmentTemplateWhereInput) {
    return this.prisma.messagingAttachmentTemplate.findMany({
      where,
      orderBy: [{ templateKey: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: {
    templateKey: string;
    name: string;
    templatePath: string;
    attachmentType: MessagingAttachmentTemplateType;
    parameterSpec: Prisma.InputJsonValue;
    description?: string | null;
    isActive?: boolean;
    createdBy?: string | null;
    updatedBy?: string | null;
  }) {
    return this.prisma.messagingAttachmentTemplate.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.MessagingAttachmentTemplateUpdateInput,
  ) {
    return this.prisma.messagingAttachmentTemplate.update({
      where: { id },
      data,
    });
  }

  async getById(id: string) {
    return this.prisma.messagingAttachmentTemplate.findUnique({
      where: { id },
    });
  }

  async getByTemplateKey(templateKey: string) {
    return this.prisma.messagingAttachmentTemplate.findMany({
      where: { templateKey, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
