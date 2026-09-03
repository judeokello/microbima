import { createHash } from 'crypto';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import {
  LctPendingAction,
  LctSubjectType,
  PolicyStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PolicyService } from '../../services/policy.service';
import {
  LCT_ERROR_CODES,
  LCT_PENDING_REASONS,
  mapPolicyStatusToLctAction,
  shouldEnqueueStatusChange,
} from './lct.types';
import { OCCUPYING_POLICY_STATUSES } from '../../utils/occupying-policy.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class LctSyncService {
  private readonly logger = new Logger(LctSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PolicyService))
    private readonly policyService: PolicyService
  ) {}

  computeProfileFingerprint(input: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    dateOfBirth?: Date | null;
    gender?: string | null;
    phoneNumber?: string | null;
    idNumber?: string | null;
    staffNumber?: string | null;
  }): string {
    const dob =
      input.dateOfBirth instanceof Date && !Number.isNaN(input.dateOfBirth.getTime())
        ? input.dateOfBirth.toISOString().slice(0, 10)
        : '';
    const payload = [
      (input.firstName ?? '').trim().toLowerCase(),
      (input.middleName ?? '').trim().toLowerCase(),
      (input.lastName ?? '').trim().toLowerCase(),
      dob,
      (input.gender ?? '').trim().toUpperCase(),
      (input.phoneNumber ?? '').trim(),
      (input.idNumber ?? '').trim().toUpperCase(),
      (input.staffNumber ?? '').trim().toUpperCase(),
    ].join('|');
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * After policy activation / member number creation — ensure targets + NEW ACTIVATE pending.
   */
  async onPolicyActivated(
    policyId: string,
    correlationId: string,
    tx?: Tx
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const policy = await client.policy.findUnique({
      where: { id: policyId },
      include: {
        customer: {
          select: {
            id: true,
            isTestUser: true,
            firstName: true,
            middleName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            phoneNumber: true,
            idNumber: true,
          },
        },
      },
    });
    if (!policy || policy.customer.isTestUser) return;

    await this.ensureMemberRowsForLateDependants(policyId, correlationId, client);
    await this.upsertTargetsForPolicy(policyId, correlationId, client);

    const action = mapPolicyStatusToLctAction(policy.status);
    if (action !== LctPendingAction.ACTIVATE) return;

    const targets = await client.lctMemberSyncTarget.findMany({
      where: { policyId, errorCode: null },
    });
    for (const target of targets) {
      if (target.lastSentAt && target.lastSentAction === LctPendingAction.ACTIVATE) {
        continue;
      }
      await this.enqueuePending(client, target.id, action, LCT_PENDING_REASONS.NEW);
    }
  }

  /**
   * Central status-change hook (from EntityStatusChangeService).
   */
  async onPolicyStatusChange(params: {
    policyId: string;
    customerId: string;
    fromStatus: string;
    toStatus: string;
    correlationId?: string;
    tx?: Tx;
  }): Promise<void> {
    const client = params.tx ?? this.prisma;
    const correlationId = params.correlationId ?? 'n/a';

    if (params.toStatus === 'ACTIVE_GRACE' || params.fromStatus === 'ACTIVE_GRACE') {
      return;
    }

    const customer = await client.customer.findUnique({
      where: { id: params.customerId },
      select: { isTestUser: true },
    });
    if (customer?.isTestUser) return;

    if (!shouldEnqueueStatusChange(params.fromStatus, params.toStatus)) {
      return;
    }

    const action = mapPolicyStatusToLctAction(params.toStatus);
    if (!action) return;

    await this.ensureMemberRowsForLateDependants(params.policyId, correlationId, client);
    await this.upsertTargetsForPolicy(params.policyId, correlationId, client);

    const targets = await client.lctMemberSyncTarget.findMany({
      where: { policyId: params.policyId },
    });

    for (const target of targets) {
      // Soft-deleted dependants keep DEPENDANT_REMOVED; skip re-enqueue for status if deleted
      if (target.dependantId) {
        const dep = await client.dependant.findUnique({
          where: { id: target.dependantId },
          select: { deletedAt: true },
        });
        if (dep?.deletedAt) continue;
      }

      const reason =
        action === LctPendingAction.ACTIVATE && !target.lastSentAt
          ? LCT_PENDING_REASONS.NEW
          : LCT_PENDING_REASONS.STATUS_CHANGE;

      await this.enqueuePending(client, target.id, action, reason);
      await this.refreshErrorFlags(client, target.id);
    }

    this.logger.log(
      `[${correlationId}] LCT status enqueue policy=${params.policyId} ${params.fromStatus}→${params.toStatus} action=${action}`
    );
  }

  async onProfileChanged(params: {
    customerId: string;
    dependantId?: string | null;
    correlationId?: string;
  }): Promise<void> {
    const correlationId = params.correlationId ?? 'n/a';
    const customer = await this.prisma.customer.findUnique({
      where: { id: params.customerId },
      select: { isTestUser: true },
    });
    if (customer?.isTestUser) return;

    const where: Prisma.LctMemberSyncTargetWhereInput = {
      customerId: params.customerId,
      ...(params.dependantId
        ? { dependantId: params.dependantId }
        : { subjectType: LctSubjectType.PRINCIPAL }),
    };

    const targets = await this.prisma.lctMemberSyncTarget.findMany({ where });
    for (const target of targets) {
      const policy = await this.prisma.policy.findUnique({
        where: { id: target.policyId },
        select: { status: true, staffNumber: true },
      });
      if (!policy) continue;
      const action = mapPolicyStatusToLctAction(policy.status);
      if (!action) continue;

      const fingerprint = await this.fingerprintForTarget(target.id);
      if (fingerprint && fingerprint === target.lastSentProfileFingerprint && !target.pendingAction) {
        continue;
      }

      // Option A: if status already pending, keep status-owned pendingAction; still add PROFILE_CHANGE reason
      if (target.pendingAction) {
        await this.addReason(this.prisma, target.id, LCT_PENDING_REASONS.PROFILE_CHANGE);
      } else {
        await this.enqueuePending(
          this.prisma,
          target.id,
          action,
          LCT_PENDING_REASONS.PROFILE_CHANGE
        );
      }
      await this.refreshErrorFlags(this.prisma, target.id);
    }

    this.logger.log(
      `[${correlationId}] LCT profile change customer=${params.customerId} dependant=${params.dependantId ?? 'principal'}`
    );
  }

  async onStaffNumberChanged(
    policyId: string,
    correlationId?: string
  ): Promise<void> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { customer: { select: { isTestUser: true } } },
    });
    if (!policy || policy.customer.isTestUser) return;

    const action = mapPolicyStatusToLctAction(policy.status);
    if (!action) return;

    await this.upsertTargetsForPolicy(policyId, correlationId ?? 'n/a');
    const targets = await this.prisma.lctMemberSyncTarget.findMany({ where: { policyId } });
    for (const target of targets) {
      if (target.pendingAction) {
        await this.addReason(this.prisma, target.id, LCT_PENDING_REASONS.PROFILE_CHANGE);
      } else {
        await this.enqueuePending(
          this.prisma,
          target.id,
          action,
          LCT_PENDING_REASONS.PROFILE_CHANGE
        );
      }
    }
  }

  async onDependantSoftDeleted(
    dependantId: string,
    correlationId?: string
  ): Promise<void> {
    const dep = await this.prisma.dependant.findUnique({
      where: { id: dependantId },
      select: { customerId: true, customer: { select: { isTestUser: true } } },
    });
    if (!dep || dep.customer.isTestUser) return;

    const targets = await this.prisma.lctMemberSyncTarget.findMany({
      where: { dependantId },
    });

    for (const target of targets) {
      const policy = await this.prisma.policy.findUnique({
        where: { id: target.policyId },
        select: { status: true },
      });
      if (!policy) continue;
      // Only if policy still sync-relevant
      if (!mapPolicyStatusToLctAction(policy.status)) continue;

      await this.enqueuePending(
        this.prisma,
        target.id,
        LctPendingAction.DEACTIVATE,
        LCT_PENDING_REASONS.DEPENDANT_REMOVED
      );
    }

    this.logger.log(
      `[${correlationId ?? 'n/a'}] LCT dependant removed dependant=${dependantId}`
    );
  }

  /**
   * Modify-product: deactivate old policy targets, activate new policy targets.
   */
  async onPolicyReplaced(params: {
    oldPolicyId: string;
    newPolicyId: string;
    correlationId?: string;
    tx?: Tx;
  }): Promise<void> {
    const client = params.tx ?? this.prisma;
    const correlationId = params.correlationId ?? 'n/a';

    const oldTargets = await client.lctMemberSyncTarget.findMany({
      where: { policyId: params.oldPolicyId },
    });
    for (const target of oldTargets) {
      await this.enqueuePending(
        client,
        target.id,
        LctPendingAction.DEACTIVATE,
        LCT_PENDING_REASONS.POLICY_REPLACED
      );
    }

    await this.ensureMemberRowsForLateDependants(params.newPolicyId, correlationId, client);
    await this.upsertTargetsForPolicy(params.newPolicyId, correlationId, client);

    const newPolicy = await client.policy.findUnique({
      where: { id: params.newPolicyId },
      select: { status: true, customer: { select: { isTestUser: true } } },
    });
    if (!newPolicy || newPolicy.customer.isTestUser) return;

    const action = mapPolicyStatusToLctAction(newPolicy.status);
    if (!action) return;

    const newTargets = await client.lctMemberSyncTarget.findMany({
      where: { policyId: params.newPolicyId },
    });
    for (const target of newTargets) {
      await this.enqueuePending(
        client,
        target.id,
        action,
        LCT_PENDING_REASONS.POLICY_REPLACED
      );
    }
  }

  async markTargetsSent(
    targetIds: string[],
    actionByTarget: Map<string, LctPendingAction>,
    correlationId: string,
    tx?: Tx
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const now = new Date();
    for (const id of targetIds) {
      const fingerprint = await this.fingerprintForTarget(id, client);
      await client.lctMemberSyncTarget.update({
        where: { id },
        data: {
          pendingAction: null,
          pendingReasons: [],
          pendingSince: null,
          lastSentAt: now,
          lastSentAction: actionByTarget.get(id) ?? null,
          lastSentProfileFingerprint: fingerprint,
          openBatchId: null,
          updatedAt: now,
        },
      });
    }
    this.logger.log(`[${correlationId}] Cleared pending on ${targetIds.length} LCT targets after send`);
  }

  async setOpenBatch(
    targetIds: string[],
    batchId: string,
    tx?: Tx
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.lctMemberSyncTarget.updateMany({
      where: { id: { in: targetIds } },
      data: { openBatchId: batchId },
    });
  }

  async clearOpenBatch(batchId: string, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    await client.lctMemberSyncTarget.updateMany({
      where: { openBatchId: batchId },
      data: { openBatchId: null },
    });
  }

  /**
   * Ensure late-added dependants get PolicyMemberDependant rows for an active-ish policy.
   */
  async ensureMemberRowsForLateDependants(
    policyId: string,
    correlationId: string,
    tx?: Tx,
    dependantIds?: string[]
  ): Promise<void> {
    if (!dependantIds || dependantIds.length === 0) return;

    const client = tx ?? this.prisma;
    const policy = await client.policy.findUnique({
      where: { id: policyId },
      include: {
        customer: {
          include: {
            dependants: { where: { deletedAt: null, id: { in: dependantIds } } },
            policyMemberPrincipals: { where: { policyId } },
          },
        },
      },
    });
    if (!policy) return;
    if (!(OCCUPYING_POLICY_STATUSES as PolicyStatus[]).includes(policy.status)) return;
    if (policy.customer.policyMemberPrincipals.length === 0) return;
    if (!policy.policyNumber && policy.status === PolicyStatus.PENDING_ACTIVATION) return;

    const existing = await client.policyMemberDependant.findMany({
      where: { policyId },
      select: { dependantId: true },
    });
    const existingIds = new Set(existing.map((e) => e.dependantId));
    const missing = this.policyService.orderDependantsForMemberNumbers(
      policy.customer.dependants.filter((d) => !existingIds.has(d.id))
    );
    if (missing.length === 0) return;

    const maxSeq = existing.length;
    for (let i = 0; i < missing.length; i++) {
      const dependant = missing[i];
      // Sequence: existing dependants already occupy 1..n; append after
      const sequence = maxSeq + i + 1;
      const memberNumber = await this.policyService.generateMemberNumberForPolicy(
        policy.packageId,
        policy.policyNumber,
        client,
        correlationId,
        sequence
      );
      await client.policyMemberDependant.create({
        data: {
          dependantId: dependant.id,
          policyId,
          memberNumber,
        },
      });
      this.logger.log(
        `[${correlationId}] Created late PolicyMemberDependant ${memberNumber} for dependant ${dependant.id}`
      );
    }
  }

  async upsertTargetsForPolicy(
    policyId: string,
    correlationId: string,
    tx?: Tx
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const policy = await client.policy.findUnique({
      where: { id: policyId },
      include: {
        customer: {
          select: {
            id: true,
            isTestUser: true,
            idNumber: true,
          },
        },
      },
    });
    if (!policy || policy.customer.isTestUser) return;

    const principal = await client.policyMemberPrincipal.findFirst({
      where: { policyId },
    });
    if (!principal) {
      // Orphan: policy without principal linkage when it should have one
      if (policy.status !== PolicyStatus.PENDING_ACTIVATION) {
        this.logger.warn(
          `[${correlationId}] ORPHAN_PRINCIPAL: no PolicyMemberPrincipal for policy ${policyId}`
        );
      }
      return;
    }

    await client.lctMemberSyncTarget.upsert({
      where: { memberNumber: principal.memberNumber },
      create: {
        policyId,
        memberNumber: principal.memberNumber,
        subjectType: LctSubjectType.PRINCIPAL,
        customerId: policy.customerId,
        dependantId: null,
        pendingReasons: [],
      },
      update: {
        policyId,
        customerId: policy.customerId,
        subjectType: LctSubjectType.PRINCIPAL,
      },
    });

    const dependantMembers = await client.policyMemberDependant.findMany({
      where: { policyId },
      include: {
        dependant: {
          select: {
            id: true,
            relationship: true,
            idNumber: true,
            deletedAt: true,
          },
        },
      },
    });

    for (const dm of dependantMembers) {
      const target = await client.lctMemberSyncTarget.upsert({
        where: { memberNumber: dm.memberNumber },
        create: {
          policyId,
          memberNumber: dm.memberNumber,
          subjectType: LctSubjectType.DEPENDANT,
          customerId: policy.customerId,
          dependantId: dm.dependantId,
          pendingReasons: [],
        },
        update: {
          policyId,
          customerId: policy.customerId,
          dependantId: dm.dependantId,
          subjectType: LctSubjectType.DEPENDANT,
        },
      });
      await this.refreshErrorFlags(client, target.id);
    }

    const principalTarget = await client.lctMemberSyncTarget.findUnique({
      where: { memberNumber: principal.memberNumber },
    });
    if (principalTarget) {
      await this.refreshErrorFlags(client, principalTarget.id);
    }
  }

  private async enqueuePending(
    client: PrismaService | Tx,
    targetId: string,
    action: LctPendingAction,
    reason: string
  ): Promise<void> {
    const target = await client.lctMemberSyncTarget.findUnique({ where: { id: targetId } });
    if (!target) return;

    const reasons = Array.from(new Set([...(target.pendingReasons ?? []), reason]));
    await client.lctMemberSyncTarget.update({
      where: { id: targetId },
      data: {
        pendingAction: action,
        pendingReasons: reasons,
        pendingSince: target.pendingSince ?? new Date(),
      },
    });
  }

  private async addReason(
    client: PrismaService | Tx,
    targetId: string,
    reason: string
  ): Promise<void> {
    const target = await client.lctMemberSyncTarget.findUnique({ where: { id: targetId } });
    if (!target) return;
    if ((target.pendingReasons ?? []).includes(reason)) return;
    await client.lctMemberSyncTarget.update({
      where: { id: targetId },
      data: {
        pendingReasons: [...(target.pendingReasons ?? []), reason],
        pendingSince: target.pendingSince ?? new Date(),
      },
    });
  }

  private async refreshErrorFlags(
    client: PrismaService | Tx,
    targetId: string
  ): Promise<void> {
    const target = await client.lctMemberSyncTarget.findUnique({ where: { id: targetId } });
    if (!target) return;

    let errorCode: string | null = null;

    if (target.subjectType === LctSubjectType.PRINCIPAL) {
      const principal = await client.policyMemberPrincipal.findFirst({
        where: { policyId: target.policyId, memberNumber: target.memberNumber },
      });
      if (!principal) {
        errorCode = LCT_ERROR_CODES.ORPHAN_PRINCIPAL;
      }
    }

    // Incomplete spouse/child data is Pending (disabled + MISSING_INFO), not Errors.
    // Legacy MISSING_SPOUSE_ID is cleared when errorCode stays null here.

    if (target.errorCode !== errorCode) {
      await client.lctMemberSyncTarget.update({
        where: { id: targetId },
        data: { errorCode },
      });
    }
  }

  private async fingerprintForTarget(
    targetId: string,
    tx?: Tx
  ): Promise<string | null> {
    const client = tx ?? this.prisma;
    const target = await client.lctMemberSyncTarget.findUnique({ where: { id: targetId } });
    if (!target) return null;

    const policy = await client.policy.findUnique({
      where: { id: target.policyId },
      select: { staffNumber: true },
    });

    if (target.subjectType === LctSubjectType.PRINCIPAL) {
      const customer = await client.customer.findUnique({
        where: { id: target.customerId },
      });
      if (!customer) return null;
      return this.computeProfileFingerprint({
        firstName: customer.firstName,
        middleName: customer.middleName,
        lastName: customer.lastName,
        dateOfBirth: customer.dateOfBirth,
        gender: customer.gender,
        phoneNumber: customer.phoneNumber,
        idNumber: customer.idNumber,
        staffNumber: policy?.staffNumber,
      });
    }

    if (!target.dependantId) return null;
    const dep = await client.dependant.findUnique({ where: { id: target.dependantId } });
    if (!dep) return null;
    return this.computeProfileFingerprint({
      firstName: dep.firstName,
      middleName: dep.middleName,
      lastName: dep.lastName,
      dateOfBirth: dep.dateOfBirth,
      gender: dep.gender,
      phoneNumber: dep.phoneNumber,
      idNumber: dep.idNumber,
      staffNumber: policy?.staffNumber,
    });
  }
}
