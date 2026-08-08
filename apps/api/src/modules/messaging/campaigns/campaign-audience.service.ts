import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValidationException } from '../../../exceptions/validation.exception';
import { normalizePhoneNumber } from '../../../utils/phone-number.util';
import { PlaceholderRendererService } from '../rendering/placeholder-renderer.service';
import {
  CampaignAudienceExpandResult,
  CampaignAudienceInput,
  CampaignCandidate,
  CampaignChannel,
} from './campaign.types';

type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string;
  status: string;
  isTestUser: boolean;
};

@Injectable()
export class CampaignAudienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly placeholderRenderer: PlaceholderRendererService,
  ) {}

  normalizePhone(raw: string): string | null {
    if (!raw || typeof raw !== 'string' || raw.trim() === '') return null;
    try {
      return normalizePhoneNumber(raw.trim());
    } catch {
      return null;
    }
  }

  normalizeEmail(raw: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
    return trimmed;
  }

  contentHash(subject: string | null | undefined, body: string): string {
    return createHash('sha256').update(`${subject ?? ''}\n${body}`).digest('hex');
  }

  async assertSelectableSchemesAndPackages(schemeIds: number[], packageIds: number[]): Promise<void> {
    const errors: Record<string, string> = {};

    if (schemeIds.length > 0) {
      const schemes = await this.prisma.scheme.findMany({
        where: { id: { in: schemeIds } },
        select: { id: true, isActive: true, schemeName: true },
      });
      const found = new Set(schemes.map((s) => s.id));
      for (const id of schemeIds) {
        if (!found.has(id)) {
          errors[`schemeIds.${id}`] = 'Scheme not found';
          continue;
        }
        const scheme = schemes.find((s) => s.id === id)!;
        if (!scheme.isActive) {
          errors[`schemeIds.${id}`] = `Scheme "${scheme.schemeName}" is inactive and cannot be selected`;
        }
      }
    }

    if (packageIds.length > 0) {
      const packages = await this.prisma.package.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, isActive: true, name: true },
      });
      const found = new Set(packages.map((p) => p.id));
      for (const id of packageIds) {
        if (!found.has(id)) {
          errors[`packageIds.${id}`] = 'Package not found';
          continue;
        }
        const pkg = packages.find((p) => p.id === id)!;
        if (!pkg.isActive) {
          errors[`packageIds.${id}`] = `Package "${pkg.name}" is inactive and cannot be selected`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw ValidationException.withMultipleErrors(errors);
    }
  }

  dedupeByAddressAndContent(candidates: CampaignCandidate[]): CampaignCandidate[] {
    const byKey = new Map<string, CampaignCandidate>();
    for (const c of candidates) {
      if (!c.normalizedAddress || c.softSkip || c.blockingError) continue;
      const key = `${c.normalizedAddress}\n${c.contentHash}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          ...c,
          contributingSchemeIds: [...(c.contributingSchemeIds ?? (c.schemeId != null ? [c.schemeId] : []))],
        });
        continue;
      }
      // SC-005 / overlapping modes: one send; union scheme attribution for pills
      const schemeSet = new Set([
        ...(existing.contributingSchemeIds ?? []),
        ...(c.contributingSchemeIds ?? []),
        ...(existing.schemeId != null ? [existing.schemeId] : []),
        ...(c.schemeId != null ? [c.schemeId] : []),
      ]);
      existing.contributingSchemeIds = Array.from(schemeSet).sort((a, b) => a - b);
      // Prefer non-null customer/policy identity when merging contact↔customer overlap
      if (!existing.customerId && c.customerId) existing.customerId = c.customerId;
      if (!existing.policyId && c.policyId) existing.policyId = c.policyId;
      if (!existing.customerName && c.customerName) existing.customerName = c.customerName;
    }
    return Array.from(byKey.values());
  }

  async expand(input: CampaignAudienceInput): Promise<CampaignAudienceExpandResult> {
    const modes = new Set(input.modes);
    const softSkipsFromExpand: CampaignAudienceExpandResult['softSkipsFromExpand'] = [];
    const raw: CampaignCandidate[] = [];

    if (modes.has('SCHEME_CUSTOMERS') || modes.has('SCHEME_CONTACTS')) {
      await this.assertSelectableSchemesAndPackages(
        input.schemeIds ?? [],
        modes.has('SCHEME_CUSTOMERS') ? input.packageIds ?? [] : [],
      );
    }

    if (modes.has('SCHEME_CUSTOMERS')) {
      raw.push(...(await this.expandSchemeCustomers(input, softSkipsFromExpand)));
    }
    if (modes.has('SCHEME_CONTACTS')) {
      raw.push(...(await this.expandSchemeContacts(input, softSkipsFromExpand)));
    }
    if (modes.has('PASTE_LIST')) {
      raw.push(...(await this.expandPasteList(input, softSkipsFromExpand)));
    }

    return { candidates: raw, softSkipsFromExpand };
  }

  private async expandSchemeCustomers(
    input: CampaignAudienceInput,
    softSkips: CampaignAudienceExpandResult['softSkipsFromExpand'],
  ): Promise<CampaignCandidate[]> {
    const packageSchemes = await this.prisma.packageScheme.findMany({
      where: {
        schemeId: { in: input.schemeIds },
        packageId: { in: input.packageIds },
      },
      select: { id: true, schemeId: true, packageId: true },
    });
    if (packageSchemes.length === 0) return [];

    const psc = await this.prisma.packageSchemeCustomer.findMany({
      where: { packageSchemeId: { in: packageSchemes.map((ps) => ps.id) } },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            status: true,
            isTestUser: true,
          },
        },
      },
    });

    const statusSet = new Set(input.customerStatuses);
    const customersById = new Map<string, CustomerRow>();
    const customerSchemeIds = new Map<string, Set<number>>();

    for (const row of psc) {
      const c = row.customer;
      if (!statusSet.has(c.status)) continue;
      // FR-019: include isTestUser — no exclusion
      customersById.set(c.id, c);
      const ps = packageSchemes.find((x) => x.id === row.packageSchemeId);
      if (ps) {
        const set = customerSchemeIds.get(c.id) ?? new Set();
        set.add(ps.schemeId);
        customerSchemeIds.set(c.id, set);
      }
    }

    const customerIds = Array.from(customersById.keys());
    if (customerIds.length === 0) return [];

    const policies = await this.prisma.policy.findMany({
      where: {
        customerId: { in: customerIds },
        status: { in: input.policyStatuses as any },
        packagePlan: { packageId: { in: input.packageIds } },
      },
      select: {
        id: true,
        customerId: true,
        policyNumber: true,
        status: true,
        packagePlan: {
          select: {
            packageId: true,
            package: { select: { id: true, name: true } },
          },
        },
      },
    });

    const selectedSchemeSet = new Set(input.schemeIds);
    const out: CampaignCandidate[] = [];
    for (const policy of policies) {
      const customer = customersById.get(policy.customerId);
      if (!customer) continue;
      const allSchemes = Array.from(customerSchemeIds.get(customer.id) ?? [])
        .filter((id) => selectedSchemeSet.has(id))
        .sort((a, b) => a - b);
      const schemeId = allSchemes[0] ?? null;
      out.push(
        this.buildCandidate({
          channel: input.channel,
          customer,
          policyId: policy.id,
          schemeId,
          contributingSchemeIds: allSchemes,
          productName: policy.packagePlan?.package?.name ?? '',
          policyNumber: policy.policyNumber ?? '',
          body: input.body,
          subject: input.subject,
          supportNumbers: input.supportNumbers,
          softSkips,
        }),
      );
    }
    return out;
  }

  private async expandSchemeContacts(
    input: CampaignAudienceInput,
    softSkips: CampaignAudienceExpandResult['softSkipsFromExpand'],
  ): Promise<CampaignCandidate[]> {
    const contacts = await this.prisma.schemeContact.findMany({
      where: { schemeId: { in: input.schemeIds } },
    });
    const out: CampaignCandidate[] = [];

    for (const contact of contacts) {
      const name = [contact.firstName, contact.otherName].filter(Boolean).join(' ');
      if (input.channel === 'SMS') {
        for (const phone of [contact.phoneNumber, contact.phoneNumber2]) {
          if (!phone) continue;
          const normalized = this.normalizePhone(phone);
          if (!normalized) {
            softSkips.push({
              customerName: name,
              phone,
              customerId: null,
              error: 'Malformed phone',
            });
            continue;
          }
          const customer = await this.prisma.customer.findFirst({
            where: { phoneNumber: normalized },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              status: true,
              isTestUser: true,
            },
          });
          out.push(
            this.buildCandidate({
              channel: 'SMS',
              customer: customer ?? null,
              overrideName: name,
              overrideAddress: normalized,
              policyId: null,
              schemeId: contact.schemeId,
              contributingSchemeIds: [contact.schemeId],
              productName: '',
              policyNumber: '',
              body: input.body,
              subject: input.subject,
              supportNumbers: input.supportNumbers,
              softSkips,
            }),
          );
        }
        if (!contact.phoneNumber && !contact.phoneNumber2) {
          softSkips.push({
            customerName: name,
            phone: null,
            customerId: null,
            error: 'Missing phone',
          });
        }
      } else {
        const email = this.normalizeEmail(contact.email ?? '');
        if (!email) {
          softSkips.push({
            customerName: name,
            email: contact.email,
            customerId: null,
            error: contact.email ? 'Malformed email' : 'Missing email',
          });
          continue;
        }
        const customer = await this.prisma.customer.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            status: true,
            isTestUser: true,
          },
        });
        out.push(
          this.buildCandidate({
            channel: 'EMAIL',
            customer: customer ?? null,
            overrideName: name,
            overrideAddress: email,
            policyId: null,
            schemeId: contact.schemeId,
            contributingSchemeIds: [contact.schemeId],
            productName: '',
            policyNumber: '',
            body: input.body,
            subject: input.subject,
            supportNumbers: input.supportNumbers,
            softSkips,
          }),
        );
      }
    }
    return out;
  }

  private async expandPasteList(
    input: CampaignAudienceInput,
    softSkips: CampaignAudienceExpandResult['softSkipsFromExpand'],
  ): Promise<CampaignCandidate[]> {
    const lines = input.pasteList ?? [];
    const out: CampaignCandidate[] = [];

    for (const line of lines) {
      if (input.channel === 'SMS') {
        const normalized = this.normalizePhone(line);
        if (!normalized) {
          softSkips.push({ phone: line, customerId: null, error: 'Malformed phone' });
          continue;
        }
        const customer = await this.prisma.customer.findFirst({
          where: { phoneNumber: normalized },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            status: true,
            isTestUser: true,
          },
        });
        out.push(
          this.buildCandidate({
            channel: 'SMS',
            customer: customer ?? null,
            overrideAddress: normalized,
            policyId: null,
            schemeId: null,
            productName: '',
            policyNumber: '',
            body: input.body,
            subject: input.subject,
            supportNumbers: input.supportNumbers,
            softSkips,
          }),
        );
      } else {
        const email = this.normalizeEmail(line);
        if (!email) {
          softSkips.push({ email: line, customerId: null, error: 'Malformed email' });
          continue;
        }
        const customer = await this.prisma.customer.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            status: true,
            isTestUser: true,
          },
        });
        out.push(
          this.buildCandidate({
            channel: 'EMAIL',
            customer: customer ?? null,
            overrideAddress: email,
            policyId: null,
            schemeId: null,
            productName: '',
            policyNumber: '',
            body: input.body,
            subject: input.subject,
            supportNumbers: input.supportNumbers,
            softSkips,
          }),
        );
      }
    }
    return out;
  }

  private buildCandidate(params: {
    channel: CampaignChannel;
    customer: CustomerRow | null;
    overrideName?: string;
    overrideAddress?: string;
    policyId: string | null;
    schemeId: number | null;
    contributingSchemeIds?: number[];
    productName: string;
    policyNumber: string;
    body: string;
    subject?: string | null;
    supportNumbers: CampaignAudienceInput['supportNumbers'];
    softSkips: CampaignAudienceExpandResult['softSkipsFromExpand'];
  }): CampaignCandidate {
    const customer = params.customer;
    const customerName =
      params.overrideName ??
      (customer ? `${customer.firstName} ${customer.lastName}`.trim() : null);

    let address: string | null = params.overrideAddress ?? null;
    if (!address && customer) {
      address =
        params.channel === 'SMS'
          ? this.normalizePhone(customer.phoneNumber)
          : this.normalizeEmail(customer.email ?? '');
    }

    const placeholderValues: Record<string, string> = {
      first_name: customer?.firstName ?? params.overrideName?.split(' ')[0] ?? '',
      last_name: customer?.lastName ?? '',
      email: customer?.email ?? (params.channel === 'EMAIL' ? address ?? '' : ''),
      phone_number: customer?.phoneNumber ?? (params.channel === 'SMS' ? address ?? '' : ''),
      policy_number: params.policyNumber,
      product_name: params.productName,
      scheme_name: '',
      general_support_number: params.supportNumbers.general_support_number,
      medical_support_number: params.supportNumbers.medical_support_number,
    };

    let softSkip: string | null = null;
    let blockingError: string | null = null;
    let renderedBody = '';
    let renderedSubject: string | null = null;

    if (!address) {
      softSkip = params.channel === 'SMS' ? 'Missing phone' : 'Missing email';
    } else {
      try {
        const bodyResult = this.placeholderRenderer.render(params.body, placeholderValues);
        renderedBody = bodyResult.rendered;
        if (params.channel === 'EMAIL' && params.subject) {
          const subj = this.placeholderRenderer.render(params.subject, placeholderValues);
          renderedSubject = subj.rendered;
        }
      } catch (err) {
        if (err instanceof ValidationException) {
          const details = err.errorDetails;
          const missing = details
            ? Object.keys(details).map((k) => `Missing placeholder: ${k}`).join('; ')
            : 'Missing placeholder values';
          blockingError = missing;
        } else {
          blockingError = 'Failed to render placeholders';
        }
      }
    }

    const hash = this.contentHash(renderedSubject, renderedBody);

    const contributingSchemeIds =
      params.contributingSchemeIds ??
      (params.schemeId != null ? [params.schemeId] : []);

    return {
      channel: params.channel,
      normalizedAddress: address,
      customerId: customer?.id ?? null,
      policyId: params.policyId,
      schemeId: params.schemeId,
      contributingSchemeIds,
      customerName,
      renderedSubject,
      renderedBody,
      contentHash: hash,
      placeholderValues,
      softSkip,
      blockingError,
    };
  }
}
