import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as path from 'path';
import * as Sentry from '@sentry/nestjs';
import { PaymentStatus } from '@prisma/client';
import type { ReactElement } from 'react';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import {
  computeExpectedPremiumThroughAsOf,
  computePremiumDueAndExcess,
  parseYmdToUtcEnd,
  parseYmdToUtcStart,
  utcDayEnd,
  utcDayStart,
} from '../utils/premium-statement-math';

const CONFIRMED: PaymentStatus[] = [PaymentStatus.COMPLETED, PaymentStatus.COMPLETED_PENDING_RECEIPT];

export interface PremiumStatementGenerateParams {
  customerId: string;
  policyId: string;
  fromDate?: string;
  toDate?: string;
  correlationId: string;
}

export interface PremiumStatementPdfResult {
  buffer: Buffer;
  filename: string;
}

function formatUkDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function formatKes(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
}

function statementLongUsDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildStatementFilename(params: {
  statementDate: Date;
  productAndPlanLabel: string;
  fullName: string;
  policyNumber: string;
}): string {
  const day = String(params.statementDate.getUTCDate()).padStart(2, '0');
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthName = monthNames[params.statementDate.getUTCMonth()];
  const safe = (s: string) =>
    s
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  const label = safe(params.productAndPlanLabel);
  const name = safe(params.fullName);
  const pol = safe(params.policyNumber.replace(/\//g, '-'));
  return `${day}-${monthName}-${label} Premium-Statement-${name}-${pol}.pdf`;
}

@Injectable()
export class PremiumStatementService {
  constructor(private readonly prismaService: PrismaService) {}

  private resolveLogoPath(): string {
    // Compiled output is dist/src/services; assets live next to dist/ under apps/api.
    return path.join(__dirname, '..', '..', '..', 'assets', 'maishapoalogo-nobg.png');
  }

  private warnSentry(reason: string, extra: Record<string, unknown>): void {
    Sentry.captureMessage(`Premium statement blocked: ${reason}`, {
      level: 'warning',
      tags: { feature: 'premium_statement', reason },
      extra,
    });
  }

  async generatePremiumStatementPdf(params: PremiumStatementGenerateParams): Promise<PremiumStatementPdfResult> {
    const { customerId, policyId, fromDate, toDate, correlationId } = params;

    const policy = await this.prismaService.policy.findFirst({
      where: { id: policyId, customerId },
      include: {
        customer: { select: { firstName: true, middleName: true, lastName: true } },
        package: {
          select: { name: true, totalPremium: true, productDurationDays: true },
        },
        packagePlan: { select: { name: true } },
      },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found or does not belong to this customer');
    }

    const schemeCustomer = await this.prismaService.packageSchemeCustomer.findFirst({
      where: {
        customerId,
        packageScheme: { packageId: policy.packageId },
      },
      include: {
        packageScheme: {
          include: { scheme: { select: { isPostpaid: true } } },
        },
      },
    });
    const isPostpaid = schemeCustomer?.packageScheme?.scheme?.isPostpaid === true;
    if (isPostpaid) {
      this.warnSentry('postpaid_policy', { customerId, policyId, correlationId });
      throw ValidationException.forField(
        'policy',
        'Premium statements are not available for postpaid policies in this release.',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const policyNumber = policy.policyNumber?.trim() ?? '';
    if (!policyNumber) {
      this.warnSentry('missing_policy_number', { customerId, policyId, correlationId });
      throw ValidationException.forField(
        'policyNumber',
        'Policy number is missing. Please contact support.',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!policy.startDate) {
      this.warnSentry('missing_start_date', { customerId, policyId, correlationId });
      throw ValidationException.forField(
        'startDate',
        'Policy start date is missing. Please contact support.',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const premiumNum = Number(policy.premium);
    if (!Number.isFinite(premiumNum) || premiumNum <= 0) {
      this.warnSentry('zero_or_invalid_premium', { customerId, policyId, correlationId });
      throw ValidationException.forField(
        'premium',
        'Installment amount is invalid for this statement. Please contact support.',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (policy.package.productDurationDays == null) {
      this.warnSentry('missing_product_duration', { customerId, policyId, correlationId });
      throw ValidationException.forField(
        'productDurationDays',
        'Product duration is not configured for this package. Please contact support.',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const cadence = policy.paymentCadence;
    if (!cadence || cadence <= 0) {
      this.warnSentry('invalid_payment_cadence', { customerId, policyId, correlationId });
      throw ValidationException.forField(
        'paymentCadence',
        'Payment cadence is invalid for this statement. Please contact support.',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const generatedAt = new Date();
    const { expectedPremium } = computeExpectedPremiumThroughAsOf({
      policyStart: policy.startDate,
      statementGenerationUtc: generatedAt,
      paymentCadenceDays: cadence,
      installmentAmount: premiumNum,
    });

    const ps = policy.startDate;
    const policyStartDay = utcDayStart(ps.getUTCFullYear(), ps.getUTCMonth(), ps.getUTCDate());
    const asOfEnd = utcDayEnd(
      generatedAt.getUTCFullYear(),
      generatedAt.getUTCMonth(),
      generatedAt.getUTCDate()
    );

    const paidThroughAsOfWhere = {
      policyId,
      paymentStatus: { in: CONFIRMED },
      expectedPaymentDate: {
        gte: policyStartDay,
        lte: asOfEnd,
      },
    };
    const paidThroughAsOfRows = await this.prismaService.policyPayment.findMany({
      where: paidThroughAsOfWhere,
      select: { amount: true },
    });
    const paidThroughAsOf = paidThroughAsOfRows.reduce((s, r) => s + Number(r.amount), 0);

    const { premiumDue, excessAmount } = computePremiumDueAndExcess(expectedPremium, paidThroughAsOf);

    const allTimeRows = await this.prismaService.policyPayment.findMany({
      where: {
        policyId,
        paymentStatus: { in: CONFIRMED },
      },
      select: { amount: true },
    });
    const allTimeCaptured = allTimeRows.reduce((s, r) => s + Number(r.amount), 0);

    const tableWhere: {
      policyId: string;
      paymentStatus: { in: PaymentStatus[] };
      expectedPaymentDate?: { gte?: Date; lte?: Date };
    } = {
      policyId,
      paymentStatus: { in: CONFIRMED },
    };
    if (fromDate || toDate) {
      tableWhere.expectedPaymentDate = {};
      if (fromDate) {
        tableWhere.expectedPaymentDate.gte = parseYmdToUtcStart(fromDate);
      }
      if (toDate) {
        tableWhere.expectedPaymentDate.lte = parseYmdToUtcEnd(toDate);
      }
    }

    const tableRows = await this.prismaService.policyPayment.findMany({
      where: tableWhere,
      orderBy: { expectedPaymentDate: 'asc' },
    });

    const filteredTotal = tableRows.reduce((s, r) => s + Number(r.amount), 0);

    const customerName = [policy.customer.firstName, policy.customer.middleName, policy.customer.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const productAndPlanLabel = [policy.package.name, policy.packagePlan?.name].filter(Boolean).join(' ').trim();

    const filename = buildStatementFilename({
      statementDate: generatedAt,
      productAndPlanLabel: productAndPlanLabel || policy.package.name,
      fullName: customerName || 'Customer',
      policyNumber,
    });

    const logoPath = this.resolveLogoPath();
    let logoBuffer: Buffer;
    try {
      logoBuffer = readFileSync(logoPath);
    } catch {
      this.warnSentry('logo_asset_missing', { customerId, policyId, correlationId, logoPath });
      throw ValidationException.forField(
        'logo',
        'Statement branding asset is missing. Please contact support.',
        ErrorCodes.INTERNAL_SERVER_ERROR
      );
    }
    const logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;

    const React = await import('react');
    const { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } = await import('@react-pdf/renderer');

    const styles = StyleSheet.create({
      page: { padding: 32, fontFamily: 'Helvetica', fontSize: 9, color: '#111' },
      logo: { width: 140, marginBottom: 12 },
      h1: { fontSize: 14, marginBottom: 4 },
      sub: { fontSize: 10, marginBottom: 2 },
      row: { flexDirection: 'row', marginBottom: 2 },
      label: { width: 160, color: '#444' },
      tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        paddingBottom: 4,
        marginTop: 12,
        fontWeight: 'bold',
      },
      tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingVertical: 4 },
      colType: { width: '18%' },
      colRef: { width: '22%' },
      colExp: { width: '20%' },
      colAct: { width: '20%' },
      colAmt: { width: '20%', textAlign: 'right' },
    });

    const tableEls: ReactElement[] = tableRows.map((r) =>
      React.createElement(
        View,
        { key: r.id, style: styles.tableRow },
        React.createElement(Text, { style: styles.colType }, String(r.paymentType)),
        React.createElement(Text, { style: styles.colRef }, r.transactionReference),
        React.createElement(Text, { style: styles.colExp }, formatUkDate(r.expectedPaymentDate)),
        React.createElement(
          Text,
          { style: styles.colAct },
          r.actualPaymentDate ? formatUkDate(r.actualPaymentDate) : '—'
        ),
        React.createElement(Text, { style: styles.colAmt }, formatKes(Number(r.amount)))
      )
    );

    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(Image, { style: styles.logo, src: logoDataUri }),
        React.createElement(Text, { style: styles.h1 }, 'Premium Statement'),
        React.createElement(Text, { style: styles.sub }, `Statement date: ${statementLongUsDate(generatedAt)} (UTC)`),
        React.createElement(Text, { style: styles.sub }, `Dear ${customerName},`),
        React.createElement(View, { style: { height: 8 } }),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Product'),
          React.createElement(Text, null, policy.package.name)
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Plan'),
          React.createElement(Text, null, policy.packagePlan?.name ?? '—')
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Premium frequency'),
          React.createElement(Text, null, String(policy.frequency))
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Installment amount'),
          React.createElement(Text, null, formatKes(premiumNum))
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Policy number'),
          React.createElement(Text, null, policyNumber)
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Policy status'),
          React.createElement(Text, null, String(policy.status))
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Policy start'),
          React.createElement(Text, null, formatUkDate(policy.startDate))
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Policy end'),
          React.createElement(Text, null, policy.endDate ? formatUkDate(policy.endDate) : '—')
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Total premium paid (filtered)'),
          React.createElement(Text, null, formatKes(filteredTotal))
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'All-time captured payments'),
          React.createElement(Text, null, formatKes(allTimeCaptured))
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Premium due (through statement date)'),
          React.createElement(Text, null, formatKes(premiumDue))
        ),
        ...(excessAmount > 0
          ? [
              React.createElement(
                View,
                { style: styles.row },
                React.createElement(Text, { style: styles.label }, 'Excess payment'),
                React.createElement(Text, null, `${formatKes(excessAmount)} (Excess Payment)`)
              ),
            ]
          : []),
        React.createElement(View, { style: { height: 8 } }),
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.colType }, 'Payment type'),
          React.createElement(Text, { style: styles.colRef }, 'Transaction reference'),
          React.createElement(Text, { style: styles.colExp }, 'Expected date'),
          React.createElement(Text, { style: styles.colAct }, 'Actual date'),
          React.createElement(Text, { style: styles.colAmt }, 'Amount')
        ),
        ...tableEls
      )
    );

    const pdfBuffer = await renderToBuffer(doc as React.ReactElement);
    return { buffer: Buffer.from(pdfBuffer), filename };
  }
}
