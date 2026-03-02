import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyService } from './policy.service';
import { SupabaseService } from './supabase.service';
import { PaymentType } from '@prisma/client';
import type { PostpaidSchemePaymentCsvRow } from '../dto/postpaid-scheme-payments/postpaid-scheme-payment.dto';

const BUCKET = 'postpaid-scheme-payments';
const CSV_REF_PREFIX = 'postpaid-';
const POLICY_PAYMENT_REF_MAX_LEN = 50;

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
    private readonly supabase: SupabaseService
  ) {}

  /**
   * List postpaid scheme payments for a scheme.
   */
  async listByScheme(
    schemeId: number,
    _correlationId: string
  ): Promise<{ id: number; schemeId: number; amount: string; paymentType: PaymentType; transactionReference: string; createdBy: string; createdAt: string; updatedAt: string }[]> {
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
   * Validate CSV and body: scheme exists and is postpaid; each id number in scheme; sum matches amount.
   * Returns validation errors or null if valid.
   */
  async validateCsvAndAmount(
    schemeId: number,
    body: { amount: number; transactionReference: string },
    csvRows: PostpaidSchemePaymentCsvRow[],
    _correlationId: string
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
      const policy = await this.prisma.policy.findUnique({
        where: {
          customerId_packageId: {
            customerId: customer.id,
            packageId: psc.packageScheme.packageId,
          },
        },
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
      { amount: body.amount, transactionReference: body.transactionReference },
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
        const policy = await tx.policy.findUnique({
          where: {
            customerId_packageId: {
              customerId: customer.id,
              packageId: psc.packageScheme.packageId,
            },
          },
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
          },
        });

        await tx.postpaidSchemePaymentItem.create({
          data: {
            postpaidSchemePaymentId: postpaid.id,
            policyPaymentId: policyPayment.id,
          },
        });

        if (policy.status === 'PENDING_ACTIVATION') {
          await this.policyService.activatePolicy(policy.id, correlationId, tx);
        }
      }

      return postpaid;
    });

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
