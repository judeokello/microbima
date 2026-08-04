import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from './policy.service';
import { PolicyLifecycleService } from './policy-lifecycle.service';
import { PaymentMessagingService } from '../modules/messaging/payment-messaging.service';
import { SupabaseService } from './supabase.service';
import { PaymentType } from '@prisma/client';
import type {
  PostpaidMpesaLookupDto,
  PostpaidSchemePaymentCsvRow,
} from '../dto/postpaid-scheme-payments/postpaid-scheme-payment.dto';

const BUCKET = 'postpaid-scheme-payments';
const CSV_REF_PREFIX = 'postpaid-';
const POLICY_PAYMENT_REF_MAX_LEN = 50;

function formatMpesaPayerName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}): string {
  return [parts.firstName, parts.middleName, parts.lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Display completion time in Africa/Nairobi with date and time. */
function formatMpesaCompletionTime(completionTime: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(completionTime);
}

/**
 * Parse CSV text. Columns: Name, phone number, amount, id number, paid date (optional).
 * First row is treated as header if it matches (case-insensitive).
 */
export function parsePostpaidPaymentCsv(csvText: string): PostpaidSchemePaymentCsvRow[] {
  const lines = csvText.trim().split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const rows: PostpaidSchemePaymentCsvRow[] = [];
  const header = lines[0].toLowerCase();
  const isHeader = header.includes('name') && header.includes('id number');
  const start = isHeader ? 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    // Simple split by comma (does not handle quoted commas)
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 4) continue;
    const name = parts[0] ?? '';
    const phoneNumber = parts[1] ?? '';
    const amountRaw = (parts[2] ?? '').trim();
    const parsed = parseFloat(amountRaw.replace(/\s/g, ''));
    const amount = Number.isFinite(parsed) ? parsed : 0;
    const idNumber = parts[3] ?? '';
    const paidDate = parts[4]?.trim() || null;
    if (!idNumber) continue;
    rows.push({ name, phoneNumber, amount, amountRaw, idNumber, paidDate });
  }
  return rows;
}

@Injectable()
export class PostpaidSchemePaymentService {
  private readonly logger = new Logger(PostpaidSchemePaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly supabase: SupabaseService,
    private readonly paymentMessagingService: PaymentMessagingService,
    private readonly policyLifecycleService: PolicyLifecycleService,
  ) {}

  /**
   * Ensure scheme exists and is postpaid.
   */
  async assertSchemeIsPostpaid(schemeId: number): Promise<void> {
    const scheme = await this.prisma.scheme.findUnique({
      where: { id: schemeId },
      select: { id: true, isPostpaid: true },
    });
    if (!scheme) {
      throw new NotFoundException(`Scheme with ID ${schemeId} not found`);
    }
    if (!scheme.isPostpaid) {
      throw new BadRequestException('Scheme is not a postpaid scheme');
    }
  }

  /**
   * List postpaid scheme payments for a scheme.
   */
  async listByScheme(
    schemeId: number,
    _correlationId: string
  ): Promise<{ id: number; schemeId: number; amount: string; paymentType: PaymentType; transactionReference: string; createdBy: string; createdAt: string; updatedAt: string }[]> {
    await this.assertSchemeIsPostpaid(schemeId);

    const payments = await this.prisma.postpaidSchemePayment.findMany({
      where: { schemeId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => ({
      id: p.id,
      schemeId: p.schemeId,
      amount: p.amount.toString(),
      paymentType: p.paymentType,
      transactionReference: p.transactionReference,
      createdBy: p.createdBy,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  /**
   * Look up an M-Pesa transaction reference in mpesa_payment_report_items for postpaid MPESA batches.
   * Rejects missing refs and refs already marked isMapped.
   */
  async lookupMpesaTransactionReference(
    transactionReference: string,
    _correlationId: string
  ): Promise<PostpaidMpesaLookupDto> {
    const ref = transactionReference.trim();
    if (!ref) {
      return {
        valid: false,
        displayLabel: null,
        transactionReference: null,
        payerName: null,
        completionTime: null,
        error: 'Transaction reference is required',
      };
    }

    const item = await this.prisma.mpesaPaymentReportItem.findFirst({
      where: { transactionReference: ref },
      orderBy: { completionTime: 'asc' },
      select: {
        id: true,
        transactionReference: true,
        firstName: true,
        middleName: true,
        lastName: true,
        completionTime: true,
        isMapped: true,
      },
    });

    if (!item) {
      return {
        valid: false,
        displayLabel: null,
        transactionReference: ref,
        payerName: null,
        completionTime: null,
        error: `No M-Pesa payment found for transaction reference "${ref}"`,
      };
    }

    if (item.isMapped) {
      return {
        valid: false,
        displayLabel: null,
        transactionReference: ref,
        payerName: formatMpesaPayerName(item) || null,
        completionTime: item.completionTime?.toISOString() ?? null,
        error: `M-Pesa transaction reference "${ref}" is already mapped and cannot be used for a postpaid payment`,
      };
    }

    if (!item.completionTime) {
      return {
        valid: false,
        displayLabel: null,
        transactionReference: ref,
        payerName: formatMpesaPayerName(item) || null,
        completionTime: null,
        error: `M-Pesa transaction reference "${ref}" has no completion time`,
      };
    }

    const payerName = formatMpesaPayerName(item);
    const when = formatMpesaCompletionTime(item.completionTime);
    const namePart = payerName || '(name not available)';
    const displayLabel = `Valid M-Pesa payment: ${namePart} — ${when}`;

    return {
      valid: true,
      displayLabel,
      transactionReference: ref,
      payerName: payerName || null,
      completionTime: item.completionTime.toISOString(),
      error: null,
    };
  }

  /**
   * Validate CSV and body: scheme exists and is postpaid; each id number in scheme; sum matches amount.
   * For MPESA, also requires an unmapped mpesa_payment_report_items row for the batch transaction reference.
   */
  async validateCsvAndAmount(
    schemeId: number,
    body: {
      amount: number;
      transactionReference: string;
      paymentType?: PaymentType;
    },
    csvRows: PostpaidSchemePaymentCsvRow[],
    correlationId: string
  ): Promise<{ valid: true } | { valid: false; errors: string[] }> {
    const errors: string[] = [];

    const scheme = await this.prisma.scheme.findUnique({
      where: { id: schemeId },
      include: {
        packageSchemes: { select: { id: true, packageId: true } },
      },
    });
    if (!scheme) {
      return { valid: false, errors: ['Scheme not found'] };
    }
    if (!scheme.isPostpaid) {
      return { valid: false, errors: ['Scheme is not a postpaid scheme'] };
    }

    if (body.paymentType === PaymentType.MPESA) {
      const lookup = await this.lookupMpesaTransactionReference(
        body.transactionReference,
        correlationId
      );
      if (!lookup.valid) {
        errors.push(lookup.error ?? 'Invalid M-Pesa transaction reference');
      }
    }

    const packageSchemeIds = scheme.packageSchemes.map((ps) => ps.id);
    let csvSum = 0;

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];

      // Amount must parse to a valid finite number and be > 0
      const parsedAmount = parseFloat((row.amountRaw ?? '').replace(/\s/g, ''));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        const displayVal = (row.amountRaw ?? '').trim() || '(empty)';
        errors.push(`Row ${i + 1}: Amount "${displayVal}" is not a valid number (must be greater than 0)`);
        continue;
      }

      const customer = await this.prisma.customer.findFirst({
        where: { idNumber: row.idNumber },
        select: { id: true },
      });
      if (!customer) {
        errors.push(`Row ${i + 1}: ID number "${row.idNumber}" does not belong to any customer in the system`);
        continue;
      }
      const psc = await this.prisma.packageSchemeCustomer.findFirst({
        where: {
          customerId: customer.id,
          packageSchemeId: { in: packageSchemeIds },
        },
        include: {
          packageScheme: { select: { packageId: true } },
        },
      });
      if (!psc) {
        errors.push(`Row ${i + 1}: ID number "${row.idNumber}" is not enrolled in this scheme`);
        continue;
      }
      const policy = await this.prisma.policy.findFirst({
        where: {
          customerId: customer.id,
          packageId: psc.packageScheme.packageId,
          status: { in: ['ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, paymentAcNumber: true },
      });
      if (!policy) {
        errors.push(`Row ${i + 1}: No policy found for customer (ID ${row.idNumber}) in this scheme`);
        continue;
      }
      if (policy.paymentAcNumber !== row.idNumber) {
        errors.push(
          `Row ${i + 1}: Policy payment account number does not match ID number (${row.idNumber}) for Customer (${row.name})`
        );
        continue;
      }

      csvSum += row.amount;
    }

    const amountMatch = Math.abs(csvSum - body.amount) < 0.01;
    if (!amountMatch) {
      errors.push(
        `CSV total (${csvSum.toFixed(2)}) does not match entered amount (${body.amount})`
      );
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }
    return { valid: true };
  }

  /**
   * Create postpaid scheme payment: upload CSV, create PostpaidSchemePayment, PolicyPayments, Items; activate policies if first payment.
   */
  async create(
    schemeId: number,
    body: {
      amount: number;
      paymentType: PaymentType;
      transactionReference: string;
      transactionDate: string;
    },
    csvBuffer: Buffer,
    createdBy: string,
    correlationId: string
  ): Promise<{
    id: number;
    schemeId: number;
    amount: string;
    paymentType: PaymentType;
    transactionReference: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }> {
    const csvText = csvBuffer.toString('utf-8');
    const csvRows = parsePostpaidPaymentCsv(csvText);
    if (csvRows.length === 0) {
      throw new BadRequestException('CSV has no valid data rows');
    }

    const validation = await this.validateCsvAndAmount(
      schemeId,
      {
        amount: body.amount,
        transactionReference: body.transactionReference,
        paymentType: body.paymentType,
      },
      csvRows,
      correlationId
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    const scheme = await this.prisma.scheme.findUnique({
      where: { id: schemeId },
      select: { schemeName: true, id: true },
    });
    if (!scheme) {
      throw new NotFoundException(`Scheme ${schemeId} not found`);
    }

    // Upload CSV to Supabase: bucket postpaid-scheme-payments, folder {schemeName}-{schemeId}
    const folder = `${scheme.schemeName}-${scheme.id}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `${body.transactionReference}-${Date.now()}.csv`;
    const storagePath = `${folder}/${fileName}`;
    try {
      const client = this.supabase.getClient();
      const { error } = await client.storage.from(BUCKET).upload(storagePath, csvBuffer, {
        contentType: 'text/csv',
        upsert: true, // Overwrite if path exists (e.g. retry with same ref in same second)
      });
      if (error) {
        this.logger.warn(`[${correlationId}] Supabase upload failed: ${error.message}`);
        // Continue without failing the flow if storage is not configured
      }
    } catch (e) {
      this.logger.warn(`[${correlationId}] CSV upload error: ${e instanceof Error ? e.message : String(e)}`);
    }

    const transactionDate = new Date(body.transactionDate);
    if (Number.isNaN(transactionDate.getTime())) {
      throw new BadRequestException('transactionDate must be a valid date');
    }

    const paymentSmsQueue: Array<{
      policyPaymentId: number;
      policyId: string;
      wasPendingActivation: boolean;
      activationSucceeded: boolean;
    }> = [];

    const created = await this.prisma.$transaction(async (tx) => {
      const postpaid = await tx.postpaidSchemePayment.create({
        data: {
          schemeId,
          amount: body.amount,
          paymentType: body.paymentType,
          transactionReference: body.transactionReference,
          transactionDate,
          createdBy,
        },
      });

      const packageSchemes = await tx.packageScheme.findMany({
        where: { schemeId },
        select: { id: true, packageId: true },
      });
      const packageSchemeIds = packageSchemes.map((ps) => ps.id);

      for (let rowIndex = 1; rowIndex <= csvRows.length; rowIndex++) {
        const row = csvRows[rowIndex - 1];
        if (row.amount <= 0) continue;
        const customer = await tx.customer.findFirst({
          where: { idNumber: row.idNumber },
          select: { id: true },
        });
        if (!customer) continue;
        const psc = await tx.packageSchemeCustomer.findFirst({
          where: {
            customerId: customer.id,
            packageSchemeId: { in: packageSchemeIds },
          },
          include: { packageScheme: { select: { packageId: true } } },
        });
        if (!psc) continue;
        const policy = await tx.policy.findFirst({
          where: {
            customerId: customer.id,
            packageId: psc.packageScheme.packageId,
            status: { in: ['ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!policy) continue;

        const ref = `${CSV_REF_PREFIX}${body.transactionReference}-${rowIndex}`;
        if (ref.length > POLICY_PAYMENT_REF_MAX_LEN) {
          throw new BadRequestException(
            `Transaction reference length exceeds ${POLICY_PAYMENT_REF_MAX_LEN} for row ${rowIndex}`
          );
        }

        // Use CSV paid date if valid; otherwise fall back to postpaid.transactionDate
        const parsedCsvDate = row.paidDate ? new Date(row.paidDate) : null;
        const isValidCsvDate =
          parsedCsvDate && !Number.isNaN(parsedCsvDate.getTime());
        const actualDate = isValidCsvDate ? parsedCsvDate : postpaid.transactionDate;

        const policyPayment = await tx.policyPayment.create({
          data: {
            policyId: policy.id,
            paymentType: body.paymentType,
            transactionReference: ref,
            amount: row.amount,
            expectedPaymentDate: postpaid.transactionDate,
            actualPaymentDate: actualDate,
            paymentStatus: 'COMPLETED',
          },
        });

        await tx.postpaidSchemePaymentItem.create({
          data: {
            postpaidSchemePaymentId: postpaid.id,
            policyPaymentId: policyPayment.id,
          },
        });

        const wasPendingActivation = policy.status === 'PENDING_ACTIVATION';
        let activationSucceeded = !wasPendingActivation;
        if (wasPendingActivation) {
          activationSucceeded = false;
          try {
            await this.policyService.activatePolicy(policy.id, correlationId, tx);
            activationSucceeded = true;
          } catch (activationError) {
            this.logger.error(
              `[${correlationId}] Postpaid CSV activation failed for policy ${policy.id}: ${
                activationError instanceof Error ? activationError.message : String(activationError)
              }`,
            );
          }
        }

        paymentSmsQueue.push({
          policyPaymentId: policyPayment.id,
          policyId: policy.id,
          wasPendingActivation,
          activationSucceeded,
        });
      }

      if (body.paymentType === PaymentType.MPESA) {
        await tx.mpesaPaymentReportItem.updateMany({
          where: { transactionReference: body.transactionReference.trim() },
          data: { isMapped: true, isProcessed: true },
        });
      }

      return postpaid;
    });

    for (const item of paymentSmsQueue) {
      this.paymentMessagingService.notifyMatchedPaymentSmsAsync({
        policyPaymentId: item.policyPaymentId,
        wasPendingActivation: item.wasPendingActivation,
        activationSucceeded: item.activationSucceeded,
        correlationId,
      });
      if (!item.wasPendingActivation || item.activationSucceeded) {
        this.policyLifecycleService
          .applyPaymentToPolicyLifecycle(item.policyId, correlationId)
          .catch((error) => {
            this.logger.warn(
              `[${correlationId}] applyPaymentToPolicyLifecycle failed for policy ${item.policyId}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          });
      }
    }

    return {
      id: created.id,
      schemeId: created.schemeId,
      amount: created.amount.toString(),
      paymentType: created.paymentType,
      transactionReference: created.transactionReference,
      createdBy: created.createdBy,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }
}
