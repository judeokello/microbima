import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MessagingChannel } from '../messaging.types';
import { ValidationException } from '../../../exceptions/validation.exception';
import { ErrorCodes } from '../../../enums/error-codes.enum';

@Injectable()
export class TemplateResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTemplate(params: {
    templateKey: string;
    channel: MessagingChannel;
    requestedLanguage: string;
    defaultLanguage: string;
  }) {
    const { templateKey, channel, requestedLanguage, defaultLanguage } = params;

    const tryLanguages = [requestedLanguage, defaultLanguage].filter((v, i, arr) => v && arr.indexOf(v) === i);

    for (const language of tryLanguages) {
      const tpl = await this.prisma.messagingTemplate.findFirst({
        where: { templateKey, channel, language, isActive: true },
      });
      if (tpl) return { template: tpl, usedLanguage: language };
    }

    throw new ValidationException(
      ErrorCodes.NOT_FOUND,
      `No active template found for key=${templateKey}, channel=${channel}, requested=${requestedLanguage}, default=${defaultLanguage}`,
    );
  }
}

