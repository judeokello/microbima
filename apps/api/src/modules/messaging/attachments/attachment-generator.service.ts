import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/** Member card data shape used for PDF generation (matches frontend MemberCardData). */
export interface MemberCardData {
  schemeName: string;
  principalMemberName: string;
  insuredMemberName: string;
  memberNumber: string | null;
  dateOfBirth: string;
  datePrinted: string;
}

/** Result of generating one attachment: buffer and suggested filename. */
export interface GeneratedAttachment {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class AttachmentGeneratorService {
  private readonly logger = new Logger(AttachmentGeneratorService.name);
  /** Base directory for HTML templates (path-based). Resolved relative to cwd. */
  private readonly templatesBaseDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.templatesBaseDir = path.join(process.cwd(), 'templates', 'attachments');
  }

  /**
   * Generate PDF from a generic HTML template: load file, replace {placeholders}, then HTML→PDF.
   * Uses Puppeteer for HTML→PDF.
   */
  async generateFromGenericHtml(
    templatePath: string,
    placeholderValues: Record<string, string>,
    suggestedFileName: string = 'document.pdf',
  ): Promise<GeneratedAttachment> {
    const fullPath = path.isAbsolute(templatePath)
      ? templatePath
      : path.join(this.templatesBaseDir, templatePath);

    let html = await fs.readFile(fullPath, 'utf-8');

    for (const [key, value] of Object.entries(placeholderValues)) {
      html = html.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });
      return {
        buffer: Buffer.from(pdfBuffer),
        fileName: suggestedFileName.endsWith('.pdf') ? suggestedFileName : `${suggestedFileName}.pdf`,
        mimeType: 'application/pdf',
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate member card PDF for a given policy and member (principal = 0, dependants = 1+).
   * Fetches data from DB and renders with React-PDF (default card layout).
   */
  async generateMemberCardPdf(
    policyId: string,
    memberIndex: number,
    suggestedFileName?: string,
  ): Promise<GeneratedAttachment> {
    const { data, cardTemplateName } = await this.getMemberCardDataForPolicy(policyId, memberIndex);
    const fileName =
      suggestedFileName ??
      `member-card-${data.insuredMemberName.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    const buffer = await this.renderMemberCardWithReactPdf(data, cardTemplateName);
    return {
      buffer,
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  /**
   * Fetch one member's card data for a policy (principal or dependant by index).
   */
  async getMemberCardDataForPolicy(
    policyId: string,
    memberIndex: number,
  ): Promise<{ data: MemberCardData; cardTemplateName: string | null }> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        customer: {
          include: {
            policyMemberPrincipals: { orderBy: { createdAt: 'desc' }, take: 1 },
            dependants: {
              where: { deletedAt: null },
              include: {
                policyMemberDependants: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
          },
        },
        package: { select: { id: true, name: true, cardTemplateName: true } },
      },
    });

    if (!policy?.customer) {
      throw new Error(`Policy or customer not found for policyId=${policyId}`);
    }

    const customer = policy.customer;
    const pkg = policy.package;
    const schemeCustomer = await this.prisma.packageSchemeCustomer.findFirst({
      where: {
        customerId: customer.id,
        packageScheme: { packageId: policy.packageId },
      },
      include: {
        packageScheme: {
          include: {
            scheme: { select: { schemeName: true } },
          },
        },
      },
    });
    const schemeName = schemeCustomer?.packageScheme?.scheme?.schemeName ?? '—';

    const principalName = [customer.firstName, customer.middleName ?? '', customer.lastName]
      .filter(Boolean)
      .join(' ');
    const principalDob = customer.dateOfBirth
      ? this.formatDateDDMMYYYY(customer.dateOfBirth)
      : '';
    const principalMember = customer.policyMemberPrincipals[0];

    if (memberIndex === 0) {
      const data: MemberCardData = {
        schemeName,
        principalMemberName: principalName,
        insuredMemberName: principalName,
        memberNumber: principalMember?.memberNumber ?? null,
        dateOfBirth: principalDob,
        datePrinted: principalMember?.createdAt
          ? this.formatDateDDMMYYYY(principalMember.createdAt)
          : '',
      };
      return { data, cardTemplateName: pkg?.cardTemplateName ?? null };
    }

    const dependantIndex = memberIndex - 1;
    const dependants = customer.dependants;
    if (dependantIndex < 0 || dependantIndex >= dependants.length) {
      throw new Error(
        `Invalid memberIndex=${memberIndex} for policyId=${policyId} (principal=0, dependants=1..${dependants.length})`,
      );
    }

    const d = dependants[dependantIndex];
    const memberDependant = d.policyMemberDependants[0];
    const fullName = [d.firstName, d.middleName ?? '', d.lastName].filter(Boolean).join(' ');
    const dob = d.dateOfBirth ? this.formatDateDDMMYYYY(d.dateOfBirth) : '';

    const data: MemberCardData = {
      schemeName,
      principalMemberName: principalName,
      insuredMemberName: fullName,
      memberNumber: memberDependant?.memberNumber ?? null,
      dateOfBirth: dob,
      datePrinted: memberDependant?.createdAt
        ? this.formatDateDDMMYYYY(memberDependant.createdAt)
        : '',
    };
    return { data, cardTemplateName: pkg?.cardTemplateName ?? null };
  }

  private formatDateDDMMYYYY(date: Date): string {
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Render member card to PDF using @react-pdf/renderer.
   * Uses a default document layout; cardTemplateName can be used later to pick different layouts.
   */
  private async renderMemberCardWithReactPdf(
    data: MemberCardData,
    _cardTemplateName: string | null,
  ): Promise<Buffer> {
    const React = await import('react');
    const { Document, Page, View, Text, renderToBuffer, StyleSheet } = await import(
      '@react-pdf/renderer'
    );

    const styles = StyleSheet.create({
      page: { padding: 24, fontFamily: 'Helvetica' },
      label: { fontSize: 10, color: '#666', marginBottom: 8 },
      value: { fontSize: 12, marginBottom: 8 },
    });

    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(View, null, React.createElement(Text, { style: styles.label }, data.schemeName)),
        React.createElement(View, null, React.createElement(Text, { style: styles.label }, `Principal: ${data.principalMemberName}`)),
        React.createElement(View, null, React.createElement(Text, { style: styles.value }, `Insured: ${data.insuredMemberName}`)),
        React.createElement(View, null, React.createElement(Text, { style: styles.value }, `Member No: ${data.memberNumber ?? 'Not assigned'}`)),
        React.createElement(View, null, React.createElement(Text, { style: styles.value }, `DOB: ${data.dateOfBirth}`)),
        React.createElement(View, null, React.createElement(Text, { style: styles.label }, `Date printed: ${data.datePrinted}`)),
      ),
    );

    const pdfBuffer = await renderToBuffer(doc as React.ReactElement);
    return Buffer.from(pdfBuffer);
  }
}
