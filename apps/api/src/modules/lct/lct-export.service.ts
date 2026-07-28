import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DependantRelationship,
  LctExportBatchStatus,
  LctPendingAction,
  LctSubjectType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SmtpEmailService } from '../messaging/providers/email-smtp.service';
import { ErrorCodes } from '../../enums/error-codes.enum';
import { ValidationException } from '../../exceptions/validation.exception';
import { buildLctCsv } from './lct-csv.builder';
import { LctStorageService } from './lct-storage.service';
import { LctSyncService } from './lct-sync.service';
import {
  buildLctExportSubject,
  formatLctDob,
  formatLctGender,
  LCT_TEMPLATE_KEY,
  LctMemberSyncIntent,
  normalizeEmailList,
} from './lct.types';

const ADMIN_ROLE = 'registration_admin';

@Injectable()
export class LctExportService {
  private readonly logger = new Logger(LctExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LctStorageService,
    private readonly sync: LctSyncService,
    private readonly smtp: SmtpEmailService
  ) {}

  assertAdmin(roles: string[]): void {
    if (!roles.includes(ADMIN_ROLE)) {
      throw new ForbiddenException('Registration admin access required');
    }
  }

  async getPending(filters: {
    name?: string;
    idNumber?: string;
    memberNumber?: string;
    phone?: string;
    product?: string;
  }) {
    const targets = await this.prisma.lctMemberSyncTarget.findMany({
      where: {
        pendingAction: { not: null },
        openBatchId: null,
        errorCode: null,
        customer: { isTestUser: false },
      },
      include: {
        policy: {
          select: {
            id: true,
            productName: true,
            staffNumber: true,
            status: true,
            policyNumber: true,
          },
        },
      },
      orderBy: [{ customerId: 'asc' }, { subjectType: 'asc' }, { memberNumber: 'asc' }],
    });

    const customerIds = [...new Set(targets.map((t) => t.customerId))];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phoneNumber: true,
        idNumber: true,
        email: true,
        dateOfBirth: true,
        gender: true,
      },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const dependantIds = targets
      .map((t) => t.dependantId)
      .filter((id): id is string => !!id);
    const dependants = await this.prisma.dependant.findMany({
      where: { id: { in: dependantIds } },
    });
    const dependantMap = new Map(dependants.map((d) => [d.id, d]));

    const nameQ = filters.name?.trim().toLowerCase();
    const idQ = filters.idNumber?.trim().toLowerCase();
    const memberQ = filters.memberNumber?.trim().toLowerCase();
    const phoneQ = filters.phone?.trim();
    const productQ = filters.product?.trim().toLowerCase();

    const enriched = targets
      .map((t) => {
        const customer = customerMap.get(t.customerId);
        const dependant = t.dependantId ? dependantMap.get(t.dependantId) : null;
        const personName = dependant
          ? [dependant.firstName, dependant.middleName, dependant.lastName].filter(Boolean).join(' ')
          : customer
            ? [customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' ')
            : '';
        const idNumber = dependant?.idNumber ?? customer?.idNumber ?? '';
        const phone = dependant?.phoneNumber ?? customer?.phoneNumber ?? '';

        return {
          id: t.id,
          policyId: t.policyId,
          memberNumber: t.memberNumber,
          subjectType: t.subjectType,
          customerId: t.customerId,
          dependantId: t.dependantId,
          pendingAction: t.pendingAction,
          pendingReasons: t.pendingReasons,
          pendingSince: t.pendingSince,
          productName: t.policy.productName,
          staffNumber: t.policy.staffNumber,
          personName,
          idNumber,
          phone,
          relationship:
            t.subjectType === LctSubjectType.PRINCIPAL
              ? 'PRINCIPAL'
              : (dependant?.relationship ?? 'DEPENDANT'),
        };
      })
      .filter((row) => {
        if (nameQ && !row.personName.toLowerCase().includes(nameQ)) return false;
        if (idQ && !row.idNumber.toLowerCase().includes(idQ)) return false;
        if (memberQ && !row.memberNumber.toLowerCase().includes(memberQ)) return false;
        if (phoneQ && !row.phone.includes(phoneQ)) return false;
        if (productQ && !row.productName.toLowerCase().includes(productQ)) return false;
        return true;
      });

    // Group by principal (customerId + policyId)
    const groups = new Map<
      string,
      { principal: (typeof enriched)[0] | null; dependants: typeof enriched; policyId: string; customerId: string }
    >();

    for (const row of enriched) {
      const key = `${row.customerId}:${row.policyId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          principal: null,
          dependants: [],
          policyId: row.policyId,
          customerId: row.customerId,
        });
      }
      const g = groups.get(key)!;
      if (row.subjectType === LctSubjectType.PRINCIPAL) {
        g.principal = row;
      } else {
        g.dependants.push(row);
      }
    }

    const openBatch = await this.prisma.lctExportBatch.findFirst({
      where: { status: LctExportBatchStatus.EXPORTED },
      orderBy: { exportedAt: 'desc' },
    });

    return {
      groups: Array.from(groups.values()),
      openBatch,
    };
  }

  async getErrors() {
    return this.prisma.lctMemberSyncTarget.findMany({
      where: {
        errorCode: { not: null },
        customer: { isTestUser: false },
      },
      include: {
        policy: { select: { productName: true, policyNumber: true, status: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listBatches() {
    return this.prisma.lctExportBatch.findMany({
      orderBy: { exportedAt: 'desc' },
      select: {
        id: true,
        status: true,
        exportedBy: true,
        exportedAt: true,
        filename: true,
        rowCount: true,
        sentAt: true,
        sentBy: true,
        cancelledAt: true,
        cancelledBy: true,
        subject: true,
        lastSendError: true,
      },
    });
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.lctExportBatch.findUnique({
      where: { id: batchId },
      include: { rows: { orderBy: { createdAt: 'asc' } } },
    });
    if (!batch) throw new NotFoundException('Export batch not found');
    return batch;
  }

  async createBatch(syncTargetIds: string[], exportedBy: string, correlationId: string) {
    if (!syncTargetIds.length) {
      throw ValidationException.forField('syncTargetIds', 'Select at least one member');
    }

    const existingExported = await this.prisma.lctExportBatch.findFirst({
      where: { status: LctExportBatchStatus.EXPORTED },
    });
    if (existingExported) {
      throw ValidationException.withMultipleErrors(
        {
          batch: `An EXPORTED batch already exists (${existingExported.id}). Send or cancel it before creating another.`,
        },
        ErrorCodes.RESOURCE_CONFLICT
      );
    }

    const targets = await this.prisma.lctMemberSyncTarget.findMany({
      where: {
        id: { in: syncTargetIds },
        pendingAction: { not: null },
        openBatchId: null,
        errorCode: null,
      },
    });

    if (targets.length !== syncTargetIds.length) {
      throw ValidationException.forField(
        'syncTargetIds',
        'One or more selected targets are not pending, have errors, or are already in an open batch'
      );
    }

    const intentsWithTargets = await this.buildIntents(targets);
    const intents = intentsWithTargets.map((x) => x.intent);
    const { csv, rows, rowCount } = buildLctCsv(intents);
    const batchId = randomUUID();
    const exportedAt = new Date();
    const filename = `lct_export_${exportedAt.toISOString().replace(/[:.]/g, '-')}.csv`;
    const storagePath = this.storage.buildStoragePath(batchId, filename);
    const storageBucket = this.storage.getBucketName();

    await this.storage.upload(storagePath, Buffer.from(csv, 'utf8'));

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lctExportBatch.create({
        data: {
          id: batchId,
          status: LctExportBatchStatus.EXPORTED,
          exportedBy,
          exportedAt,
          filename,
          storageBucket,
          storagePath,
          rowCount,
        },
      });

      await tx.lctExportBatchRow.createMany({
        data: intentsWithTargets.map((item, idx) => ({
          batchId,
          syncTargetId: item.targetId,
          memberNumber: item.intent.memberNumber,
          action: item.intent.action,
          reasons: item.intent.reasons,
          csvSnapshot: rows[idx] as unknown as Prisma.InputJsonValue,
        })),
      });

      await this.sync.setOpenBatch(
        targets.map((t) => t.id),
        batchId,
        tx
      );

      return created;
    });

    this.logger.log(
      `[${correlationId}] Created LCT export batch ${batchId} with ${rowCount} rows`
    );
    return batch;
  }

  async sendBatch(
    batchId: string,
    user: { id: string; email?: string | null },
    body: {
      toEmails?: string[];
      ccEmails?: string[];
      bccEmails?: string[];
      bodyHtml?: string;
      bodyText?: string;
    },
    correlationId: string
  ) {
    const batch = await this.prisma.lctExportBatch.findUnique({
      where: { id: batchId },
      include: { rows: true },
    });
    if (!batch) throw new NotFoundException('Export batch not found');
    if (batch.status !== LctExportBatchStatus.EXPORTED) {
      throw ValidationException.forField('status', 'Only EXPORTED batches can be sent');
    }

    const template = await this.prisma.messagingTemplate.findFirst({
      where: {
        templateKey: LCT_TEMPLATE_KEY,
        channel: 'EMAIL',
        language: 'en',
        isActive: true,
      },
    });
    if (!template) {
      throw ValidationException.forField('template', 'lct_customer_export EMAIL template not found or inactive');
    }

    const recipientConfig = await this.prisma.messagingEmailRecipientConfig.findUnique({
      where: { templateKey: LCT_TEMPLATE_KEY },
    });

    const toEmails = normalizeEmailList(
      body.toEmails ?? recipientConfig?.toEmails ?? []
    );
    let ccEmails = normalizeEmailList(
      body.ccEmails ?? recipientConfig?.ccEmails ?? []
    );
    const bccEmails = normalizeEmailList(
      body.bccEmails ?? recipientConfig?.bccEmails ?? []
    );

    // Merge logged-in user into CC
    if (user.email) {
      ccEmails = normalizeEmailList([...ccEmails, user.email]);
    }

    if (!toEmails.length) {
      throw ValidationException.forField('toEmails', 'At least one To recipient is required');
    }

    const exportedAtIso = batch.exportedAt.toISOString();
    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{row_count\}/g, String(batch.rowCount))
        .replace(/\{exported_at\}/g, exportedAtIso);

    const bodyHtml = replacePlaceholders(body.bodyHtml ?? template.body);
    const bodyText = replacePlaceholders(
      body.bodyText ?? template.textBody ?? template.body.replace(/<[^>]+>/g, '')
    );
    const subject = buildLctExportSubject(new Date());

    const fileBuffer = await this.storage.download(batch.storagePath);

    try {
      const result = await this.smtp.sendEmail({
        to: toEmails.join(', '),
        cc: ccEmails.length ? ccEmails.join(', ') : undefined,
        bcc: bccEmails.length ? bccEmails.join(', ') : undefined,
        subject,
        htmlBody: bodyHtml,
        textBody: bodyText,
        attachments: [
          {
            filename: batch.filename,
            content: fileBuffer,
            contentType: 'text/csv',
          },
        ],
      });

      const actionByTarget = new Map<string, LctPendingAction>();
      const targetIds: string[] = [];
      for (const row of batch.rows) {
        if (row.syncTargetId) {
          targetIds.push(row.syncTargetId);
          actionByTarget.set(row.syncTargetId, row.action);
        }
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.lctExportBatch.update({
          where: { id: batchId },
          data: {
            status: LctExportBatchStatus.SENT,
            sentAt: new Date(),
            sentBy: user.id,
            smtpMessageId: result.messageId,
            toEmails,
            ccEmails,
            bccEmails,
            subject,
            bodyHtml,
            bodyText,
            lastSendError: null,
          },
        });
        await this.sync.markTargetsSent(targetIds, actionByTarget, correlationId, tx);
      });

      this.logger.log(`[${correlationId}] Sent LCT batch ${batchId} messageId=${result.messageId}`);
      return this.getBatch(batchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SMTP send failed';
      await this.prisma.lctExportBatch.update({
        where: { id: batchId },
        data: { lastSendError: message },
      });
      throw error;
    }
  }

  async cancelBatch(batchId: string, cancelledBy: string, correlationId: string) {
    const batch = await this.prisma.lctExportBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Export batch not found');
    if (batch.status !== LctExportBatchStatus.EXPORTED) {
      throw ValidationException.forField('status', 'Only EXPORTED batches can be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lctExportBatch.update({
        where: { id: batchId },
        data: {
          status: LctExportBatchStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy,
        },
      });
      await this.sync.clearOpenBatch(batchId, tx);
    });

    this.logger.log(`[${correlationId}] Cancelled LCT batch ${batchId}`);
    return this.getBatch(batchId);
  }

  async downloadBatch(batchId: string): Promise<{ filename: string; buffer: Buffer }> {
    const batch = await this.prisma.lctExportBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Export batch not found');
    const buffer = await this.storage.download(batch.storagePath);
    return { filename: batch.filename, buffer };
  }

  async getRecipientConfig(templateKey: string) {
    const config = await this.prisma.messagingEmailRecipientConfig.findUnique({
      where: { templateKey },
    });
    if (!config) throw new NotFoundException('Recipient config not found');
    return config;
  }

  async updateRecipientConfig(
    templateKey: string,
    data: { toEmails?: string[]; ccEmails?: string[]; bccEmails?: string[] },
    updatedBy: string
  ) {
    const existing = await this.prisma.messagingEmailRecipientConfig.findUnique({
      where: { templateKey },
    });
    if (!existing) throw new NotFoundException('Recipient config not found');

    return this.prisma.messagingEmailRecipientConfig.update({
      where: { templateKey },
      data: {
        ...(data.toEmails !== undefined ? { toEmails: normalizeEmailList(data.toEmails) } : {}),
        ...(data.ccEmails !== undefined ? { ccEmails: normalizeEmailList(data.ccEmails) } : {}),
        ...(data.bccEmails !== undefined ? { bccEmails: normalizeEmailList(data.bccEmails) } : {}),
        updatedBy,
      },
    });
  }

  async updatePolicyStaffNumber(
    policyId: string,
    staffNumber: string | null,
    correlationId: string
  ) {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) throw new NotFoundException('Policy not found');

    const updated = await this.prisma.policy.update({
      where: { id: policyId },
      data: { staffNumber: staffNumber?.trim() ? staffNumber.trim() : null },
    });

    await this.sync.onStaffNumberChanged(policyId, correlationId);
    return updated;
  }

  private async buildIntents(
    targets: Array<{
      id: string;
      policyId: string;
      memberNumber: string;
      subjectType: LctSubjectType;
      customerId: string;
      dependantId: string | null;
      pendingAction: LctPendingAction | null;
      pendingReasons: string[];
    }>
  ): Promise<Array<{ targetId: string; intent: LctMemberSyncIntent }>> {
    const intents: Array<{ targetId: string; intent: LctMemberSyncIntent }> = [];

    for (const target of targets) {
      if (!target.pendingAction) continue;

      const policy = await this.prisma.policy.findUnique({
        where: { id: target.policyId },
        select: { staffNumber: true, customerId: true },
      });
      const customer = await this.prisma.customer.findUnique({
        where: { id: target.customerId },
      });
      if (!policy || !customer) continue;

      const principalMember = await this.prisma.policyMemberPrincipal.findFirst({
        where: { policyId: target.policyId },
      });
      const principalMemberNumber = principalMember?.memberNumber ?? '';
      const employeeName = [customer.firstName, customer.middleName, customer.lastName]
        .filter(Boolean)
        .join(' ');

      if (target.subjectType === LctSubjectType.PRINCIPAL) {
        intents.push({
          targetId: target.id,
          intent: {
            memberNumber: target.memberNumber,
            action: target.pendingAction,
            policyId: target.policyId,
            customerId: target.customerId,
            dependantId: null,
            subjectType: 'PRINCIPAL',
            reasons: target.pendingReasons,
            employeeName,
            staffNumber: policy.staffNumber ?? '',
            memberName: employeeName,
            gender: formatLctGender(customer.gender),
            dateOfBirth: formatLctDob(customer.dateOfBirth),
            relationship: 'PRINCIPAL',
            email: customer.email ?? '',
            phoneNumber: customer.phoneNumber ?? '',
            idNumber: customer.idNumber ?? '',
            principalMemberNumber: '',
          },
        });
        continue;
      }

      const dependant = target.dependantId
        ? await this.prisma.dependant.findUnique({ where: { id: target.dependantId } })
        : null;
      if (!dependant) continue;

      const relationship =
        dependant.relationship === DependantRelationship.SPOUSE
          ? 'SPOUSE'
          : dependant.relationship === DependantRelationship.CHILD
            ? 'CHILD'
            : dependant.relationship;

      intents.push({
        targetId: target.id,
        intent: {
          memberNumber: target.memberNumber,
          action: target.pendingAction,
          policyId: target.policyId,
          customerId: target.customerId,
          dependantId: dependant.id,
          subjectType: 'DEPENDANT',
          reasons: target.pendingReasons,
          employeeName,
          staffNumber: policy.staffNumber ?? '',
          memberName: [dependant.firstName, dependant.middleName, dependant.lastName]
            .filter(Boolean)
            .join(' '),
          gender: formatLctGender(dependant.gender),
          dateOfBirth: formatLctDob(dependant.dateOfBirth),
          relationship,
          email: dependant.email ?? '',
          phoneNumber: dependant.phoneNumber ?? '',
          idNumber: dependant.idNumber ?? '',
          principalMemberNumber,
        },
      });
    }

    return intents;
  }
}
