import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  StatusChangeEntityType,
  StatusChangeTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordStatusChangeParams {
  entityType: StatusChangeEntityType;
  customerId: string;
  policyId?: string | null;
  fromStatus: string;
  toStatus: string;
  reason: string;
  trigger: StatusChangeTrigger;
  changedBy: string;
  correlationId?: string;
  metadata?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class EntityStatusChangeService {
  private readonly logger = new Logger(EntityStatusChangeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordStatusChangeParams): Promise<void> {
    const client = params.tx ?? this.prisma;
    await client.entityStatusChange.create({
      data: {
        entityType: params.entityType,
        customerId: params.customerId,
        policyId: params.policyId ?? null,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        reason: params.reason,
        trigger: params.trigger,
        changedBy: params.changedBy,
        correlationId: params.correlationId ?? null,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
    });
    this.logger.log(
      `[${params.correlationId ?? 'n/a'}] Status change ${params.entityType} ${params.fromStatus} → ${params.toStatus} (customer=${params.customerId})`
    );
  }
}
