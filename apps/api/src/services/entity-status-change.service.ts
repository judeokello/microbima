import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  StatusChangeEntityType,
  StatusChangeTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LctSyncService } from '../modules/lct/lct-sync.service';

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

/** Audit marker for grace overlay enter (member-facing status stays ACTIVE). */
export const POLICY_STATUS_ACTIVE_GRACE = 'ACTIVE_GRACE';

@Injectable()
export class EntityStatusChangeService {
  private readonly logger = new Logger(EntityStatusChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lctSyncService: LctSyncService
  ) {}

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

    if (
      params.entityType === StatusChangeEntityType.POLICY &&
      params.policyId &&
      params.toStatus !== POLICY_STATUS_ACTIVE_GRACE &&
      params.fromStatus !== POLICY_STATUS_ACTIVE_GRACE
    ) {
      await this.lctSyncService.onPolicyStatusChange({
        policyId: params.policyId,
        customerId: params.customerId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        correlationId: params.correlationId,
        tx: params.tx,
      });
    }
  }

  /**
   * Required for every Policy status transition and grace enter/exit.
   * Triggers: SYSTEM (daily), PAYMENT_LIFECYCLE (payments), MANUAL_ADMIN (admin).
   */
  async recordPolicyChange(
    params: Omit<RecordStatusChangeParams, 'entityType'> & { policyId: string }
  ): Promise<void> {
    await this.record({
      ...params,
      entityType: StatusChangeEntityType.POLICY,
    });
  }

  /** Grace enter: ACTIVE → ACTIVE_GRACE (overlay only; Policy.status remains ACTIVE). */
  async recordGraceEnter(
    params: Omit<RecordStatusChangeParams, 'entityType' | 'fromStatus' | 'toStatus'> & {
      policyId: string;
      fromStatus?: string;
    }
  ): Promise<void> {
    await this.recordPolicyChange({
      ...params,
      fromStatus: params.fromStatus ?? 'ACTIVE',
      toStatus: POLICY_STATUS_ACTIVE_GRACE,
    });
  }

  /** Grace exit: ACTIVE_GRACE → ACTIVE (or next status such as SUSPENDED via recordPolicyChange). */
  async recordGraceExit(
    params: Omit<RecordStatusChangeParams, 'entityType' | 'fromStatus' | 'toStatus'> & {
      policyId: string;
      toStatus?: string;
    }
  ): Promise<void> {
    await this.recordPolicyChange({
      ...params,
      fromStatus: POLICY_STATUS_ACTIVE_GRACE,
      toStatus: params.toStatus ?? 'ACTIVE',
    });
  }
}
