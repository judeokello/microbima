import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MessagingRoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.messagingRoute.findMany({ orderBy: { templateKey: 'asc' } });
  }

  async upsertByTemplateKey(templateKey: string, data: Omit<Prisma.MessagingRouteCreateInput, 'templateKey'>) {
    return this.prisma.messagingRoute.upsert({
      where: { templateKey },
      create: { templateKey, ...data },
      update: { ...data },
    });
  }
}

