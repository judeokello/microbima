import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigurationService } from '../../config/configuration.service';
import { SupabaseService } from '../../services/supabase.service';
import { MessagingService } from '../messaging/messaging.service';
import { ValidationException } from '../../exceptions/validation.exception';
import {
  international254ToNational07,
  maskNationalPhoneForPortal,
} from '../../utils/customer-portal-auth.util';

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigurationService,
    private readonly supabaseService: SupabaseService,
    private readonly messagingService: MessagingService,
  ) {}

  buildPersonalPortalUrl(customerId: string): string {
    const base = this.configService.customerPortal.publicBaseUrl.replace(/\/$/, '');
    return `${base}/self/customer/${customerId}`;
  }

  /**
   * Uniform non-enumerating payload for deep-link pre-auth screen (FR-001a).
   */
  async getLoginDisplayContext(customerId: string, correlationId: string): Promise<{
    maskedPhoneNational: string;
    firstName: string;
    lastName: string;
  }> {
    this.logger.log(`[${correlationId}] customer-portal login context for ${customerId}`);
    const empty = { maskedPhoneNational: '', firstName: '', lastName: '' };
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { phoneNumber: true, firstName: true, lastName: true },
    });
    if (!customer) {
      return empty;
    }
    try {
      const national07 = international254ToNational07(customer.phoneNumber);
      return {
        maskedPhoneNational: maskNationalPhoneForPortal(national07),
        firstName: customer.firstName ?? '',
        lastName: customer.lastName ?? '',
      };
    } catch {
      return {
        maskedPhoneNational: '',
        firstName: customer.firstName ?? '',
        lastName: customer.lastName ?? '',
      };
    }
  }

  async getPortalSetupStatus(customerId: string, correlationId: string): Promise<{
    portalPinSetupCompleted: boolean;
    portalPinSetupCompletedAt: string | null;
  }> {
    this.logger.log(`[${correlationId}] customer-portal setup status for ${customerId}`);
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { portalPinSetupCompletedAt: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const at = customer.portalPinSetupCompletedAt;
    return {
      portalPinSetupCompleted: at != null,
      portalPinSetupCompletedAt: at?.toISOString() ?? null,
    };
  }

  async completePinSetup(
    customerId: string,
    pin: string,
    pinConfirm: string,
    correlationId: string,
  ): Promise<void> {
    if (pin !== pinConfirm) {
      throw ValidationException.withMultipleErrors({
        pinConfirm: 'PIN and confirmation do not match',
      });
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.portalPinSetupCompletedAt) {
      throw ValidationException.forField('pin', 'PIN setup already completed');
    }

    const pw = await this.supabaseService.updateCustomerPortalPassword(customerId, pin);
    if (!pw.ok) {
      this.logger.error(`[${correlationId}] Supabase password update failed: ${pw.error}`);
      throw ValidationException.forField('pin', 'Unable to update PIN. Please try again.');
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { portalPinSetupCompletedAt: new Date() },
    });

    const link = this.buildPersonalPortalUrl(customerId);
    await this.messagingService.enqueue({
      templateKey: 'portal_pin_setup_complete',
      customerId,
      placeholderValues: {
        first_name: customer.firstName,
        last_name: customer.lastName,
        email: customer.email ?? '',
        customer_specific_weblogin: link,
      },
      correlationId,
    });
  }

  /**
   * Policies dropdown list (for payments/filter select).
   * `sub` from JWT is the authoritative customer id — no extra check needed.
   */
  async getPortalPolicies(customerId: string, correlationId: string) {
    this.logger.log(`[${correlationId}] portal policies for ${customerId}`);
    const policies = await this.prisma.policy.findMany({
      where: { customerId },
      include: {
        package: { select: { name: true } },
        packagePlan: { select: { name: true } },
      },
    });
    return {
      status: 200,
      correlationId,
      message: 'Policies retrieved',
      data: policies.map((p) => ({
        id: p.id,
        displayText: p.packagePlan ? `${p.package.name} - ${p.packagePlan.name}` : p.package.name,
        packageName: p.package.name,
        planName: p.packagePlan?.name,
      })),
    };
  }

  /**
   * Rich policies list for the Products tab.
   */
  async getPortalPoliciesList(customerId: string, correlationId: string) {
    this.logger.log(`[${correlationId}] portal policies list for ${customerId}`);
    const policies = await this.prisma.policy.findMany({
      where: { customerId },
      include: {
        package: {
          select: { name: true, totalPremium: true, underwriter: { select: { name: true } } },
        },
        packagePlan: { select: { name: true } },
        policyPayments: {
          select: { expectedPaymentDate: true, actualPaymentDate: true, amount: true },
        },
      },
    });

    const now = new Date();
    const data = await Promise.all(
      policies.map(async (p) => {
        const schemeCustomer = await this.prisma.packageSchemeCustomer.findFirst({
          where: { customerId, packageScheme: { packageId: p.packageId } },
          include: {
            packageScheme: { include: { scheme: { select: { schemeName: true } } } },
          },
        });
        const schemeName = schemeCustomer?.packageScheme?.scheme?.schemeName ?? '—';
        const installmentsPaid = p.policyPayments.filter((pm) => pm.actualPaymentDate != null).length;
        const missedPayments = p.policyPayments.filter(
          (pm) => pm.expectedPaymentDate < now && pm.actualPaymentDate == null,
        ).length;
        return {
          id: p.id,
          productName: p.productName,
          packageName: p.package.name,
          planName: p.packagePlan?.name ?? null,
          schemeName,
          underwriterName: p.package.underwriter?.name ?? null,
          status: p.status,
          totalPremium: p.package.totalPremium != null ? p.package.totalPremium.toString() : '—',
          installment: p.premium.toString(),
          installmentsPaid,
          missedPayments,
        };
      }),
    );

    return { status: 200, correlationId, message: 'Products list retrieved', data };
  }

  /**
   * Single policy detail for product detail page.
   */
  async getPortalPolicyDetail(customerId: string, policyId: string, correlationId: string) {
    this.logger.log(`[${correlationId}] portal policy detail ${policyId} for ${customerId}`);
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, customerId },
      include: {
        package: {
          select: {
            name: true,
            totalPremium: true,
            productDurationDays: true,
            underwriter: { select: { name: true } },
          },
        },
        packagePlan: { select: { name: true } },
        policyPayments: {
          select: {
            expectedPaymentDate: true,
            actualPaymentDate: true,
            amount: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found or does not belong to this customer');
    }

    const schemeCustomer = await this.prisma.packageSchemeCustomer.findFirst({
      where: { customerId, packageScheme: { packageId: policy.packageId } },
      include: {
        packageScheme: {
          include: { scheme: { select: { schemeName: true, isPostpaid: true } } },
        },
      },
    });
    const schemeName = schemeCustomer?.packageScheme?.scheme?.schemeName ?? '—';
    const packageSchemeId = schemeCustomer?.packageSchemeId ?? null;
    const isPostpaid = schemeCustomer?.packageScheme?.scheme?.isPostpaid === true;
    const schemeBillingMode: 'prepaid' | 'postpaid' = isPostpaid ? 'postpaid' : 'prepaid';

    const installmentsPaid = policy.policyPayments.filter((pm) => pm.actualPaymentDate != null).length;
    const now = new Date();
    const missedPayments = policy.policyPayments.filter(
      (pm) => pm.expectedPaymentDate < now && pm.actualPaymentDate == null,
    ).length;
    const totalPaidToDate = policy.policyPayments
      .filter((pm) => pm.actualPaymentDate != null)
      .reduce((sum, pm) => sum + Number(pm.amount), 0);

    return {
      status: 200,
      correlationId,
      message: 'Policy detail retrieved',
      data: {
        id: policy.id,
        policyNumber: policy.policyNumber,
        status: policy.status,
        packageId: policy.packageId,
        packageSchemeId,
        schemeBillingMode,
        product: {
          underwriterName: policy.package.underwriter?.name ?? null,
          packageName: policy.package.name,
          planName: policy.packagePlan?.name ?? null,
          schemeName,
          productName: policy.productName,
          productDurationDays: policy.package.productDurationDays,
        },
        enrollment: {
          startDate: policy.startDate?.toISOString() ?? null,
          endDate: policy.endDate?.toISOString() ?? null,
          frequency: policy.frequency,
          paymentCadence: policy.paymentCadence,
        },
        totalPremium: policy.package.totalPremium?.toString() ?? '—',
        installmentAmount: policy.premium.toString(),
        totalPaidToDate: totalPaidToDate.toString(),
        installmentsPaid,
        missedPayments,
      },
    };
  }

  /**
   * Customer payments with optional filters.
   */
  async getPortalPayments(
    customerId: string,
    filters: { policyId?: string; fromDate?: string; toDate?: string },
    correlationId: string,
  ) {
    this.logger.log(`[${correlationId}] portal payments for ${customerId}`);
    const where: Prisma.PolicyPaymentWhereInput = { policy: { customerId } };

    if (filters.policyId) {
      where.policyId = filters.policyId;
    }
    if (filters.fromDate || filters.toDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.fromDate) {
        const [y, m, d] = filters.fromDate.split('-').map(Number);
        dateFilter.gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      }
      if (filters.toDate) {
        const [y, m, d] = filters.toDate.split('-').map(Number);
        dateFilter.lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      }
      where.expectedPaymentDate = dateFilter;
    }

    const payments = await this.prisma.policyPayment.findMany({
      where,
      orderBy: { expectedPaymentDate: 'desc' },
    });

    return {
      status: 200,
      correlationId,
      message: 'Payments retrieved',
      data: payments.map((p) => ({
        id: p.id,
        paymentType: p.paymentType,
        transactionReference: p.transactionReference ?? '',
        accountNumber: p.accountNumber ?? undefined,
        expectedPaymentDate: p.expectedPaymentDate.toISOString(),
        actualPaymentDate: p.actualPaymentDate?.toISOString(),
        amount: Number(p.amount),
        paymentStatus: p.paymentStatus,
      })),
    };
  }

  /**
   * Member cards for the customer.
   */
  async getPortalMemberCards(customerId: string, correlationId: string) {
    this.logger.log(`[${correlationId}] portal member-cards for ${customerId}`);
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        dependants: {
          where: { deletedAt: null },
          include: {
            policyMemberDependants: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
        policyMemberPrincipals: { orderBy: { createdAt: 'desc' }, take: 1 },
        policies: {
          include: {
            package: { select: { id: true, name: true, cardTemplateName: true } },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const principalName = [customer.firstName, customer.middleName ?? '', customer.lastName]
      .filter(Boolean)
      .join(' ');

    const formatDDMMYYYY = (d: Date | null) => {
      if (!d) return '';
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const memberCardsByPolicy = customer.policies.map((policy) => {
      const principalMember = customer.policyMemberPrincipals[0];
      const principalDob = formatDDMMYYYY(customer.dateOfBirth);
      const principalEntry = {
        schemeName: policy.package.name,
        principalMemberName: principalName,
        insuredMemberName: principalName,
        memberNumber: principalMember?.memberNumber ?? null,
        dateOfBirth: principalDob,
        datePrinted: formatDDMMYYYY(new Date()),
      };

      const dependants = customer.dependants.map((dep) => {
        const depName = [dep.firstName, dep.middleName ?? '', dep.lastName].filter(Boolean).join(' ');
        const depMember = dep.policyMemberDependants[0];
        return {
          schemeName: policy.package.name,
          principalMemberName: principalName,
          insuredMemberName: depName,
          memberNumber: depMember?.memberNumber ?? null,
          dateOfBirth: formatDDMMYYYY(dep.dateOfBirth),
          datePrinted: formatDDMMYYYY(new Date()),
        };
      });

      return {
        policyId: policy.id,
        policyNumber: policy.policyNumber,
        packageId: policy.packageId,
        packageName: policy.package.name,
        cardTemplateName: policy.package.cardTemplateName,
        schemeName: policy.package.name,
        principal: principalEntry,
        dependants,
      };
    });

    return { memberCardsByPolicy };
  }
}
