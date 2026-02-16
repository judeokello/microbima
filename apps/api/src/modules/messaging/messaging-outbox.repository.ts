import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessagingOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Implemented in T015 (claim rows safely, update statuses, etc.)
}

