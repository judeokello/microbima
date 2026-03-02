import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestCustomerDto } from '../dto/test-customers';
import { normalizePhoneNumber } from '../utils/phone-number.util';
import { ValidationException } from '../exceptions/validation.exception';

export interface TestCustomerListOptions {
  page?: number;
  pageSize?: number;
}

export interface DeletePreviewResult {
  /** Count of customers with this phone that are marked isTestUser=true */
  customersCount: number;
  /** Count of all customers with this phone (any isTestUser), for diagnostics */
  totalCustomersWithPhone: number;
  customer?: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
}

@Injectable()
export class TestCustomersService {
  private readonly logger = new Logger(TestCustomersService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * List test customers with pagination
   */
  async list(
    options: TestCustomerListOptions = {},
    _correlationId: string
  ): Promise<{
    data: Array<{
      id: string;
      name: string;
      phoneNumber: string;
      createdAt: Date;
      createdBy: string | null;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const [items, totalItems] = await Promise.all([
      this.prismaService.testCustomer.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prismaService.testCustomer.count(),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Create a test customer
   */
  async create(
    dto: CreateTestCustomerDto,
    userId: string | undefined,
    correlationId: string
  ): Promise<{
    id: string;
    name: string;
    phoneNumber: string;
    createdAt: Date;
    createdBy: string | null;
  }> {
    this.logger.log(`[${correlationId}] Creating test customer: ${dto.name}`);

    const normalizedPhone = normalizePhoneNumber(dto.phoneNumber);

    const existing = await this.prismaService.testCustomer.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (existing) {
      throw ValidationException.forField(
        'phoneNumber',
        'This phone number is already registered as a test user'
      );
    }

    const created = await this.prismaService.testCustomer.create({
      data: {
        name: dto.name,
        phoneNumber: normalizedPhone,
        createdBy: userId ?? null,
      },
    });

    // Sync: set isTestUser=true on existing ACTIVE customers with matching phone
    const phoneVariants = this.getPhoneVariantsForMatch(normalizedPhone);
    await this.prismaService.customer.updateMany({
      where: {
        phoneNumber: { in: phoneVariants },
        status: 'ACTIVE',
      },
      data: { isTestUser: true },
    });

    return created;
  }

  /**
   * Get delete preview: count of customers with this test customer's phone, and customer details if exactly one.
   * Used by UI to show confirmation string or multi-customer error.
   */
  async getDeletePreview(
    id: string,
    _correlationId: string
  ): Promise<DeletePreviewResult> {
    const existing = await this.prismaService.testCustomer.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Test customer with ID ${id} not found`);
    }

    const phoneVariants = this.getPhoneVariantsForMatch(existing.phoneNumber);

    const [testUserCustomers, totalWithPhone] = await Promise.all([
      this.prismaService.customer.findMany({
        where: {
          phoneNumber: { in: phoneVariants },
          isTestUser: true,
        },
        select: {
          firstName: true,
          lastName: true,
          phoneNumber: true,
        },
      }),
      this.prismaService.customer.count({
        where: { phoneNumber: { in: phoneVariants } },
      }),
    ]);

    if (testUserCustomers.length === 1) {
      const c = testUserCustomers[0];
      return {
        customersCount: 1,
        totalCustomersWithPhone: totalWithPhone,
        customer: {
          firstName: c.firstName?.trim() ?? '',
          lastName: c.lastName?.trim() ?? '',
          phoneNumber: c.phoneNumber?.trim() ?? '',
        },
      };
    }

    return {
      customersCount: testUserCustomers.length,
      totalCustomersWithPhone: totalWithPhone,
    };
  }

  /**
   * Delete a test customer. Optionally hard-delete the customer record.
   * @param deleteCustomerRecord - If true, hard-deletes the customer and all related records. Requires exactly one customer with that phone.
   */
  async delete(
    id: string,
    correlationId: string,
    deleteCustomerRecord = false
  ): Promise<void> {
    this.logger.log(
      `[${correlationId}] Deleting test customer: ${id}, deleteCustomerRecord=${deleteCustomerRecord}`
    );

    const existing = await this.prismaService.testCustomer.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Test customer with ID ${id} not found`);
    }

    const phoneVariants = this.getPhoneVariantsForMatch(existing.phoneNumber);
    const customers = await this.prismaService.customer.findMany({
      where: {
        phoneNumber: { in: phoneVariants },
        isTestUser: true,
      },
      select: { id: true },
    });

    if (deleteCustomerRecord) {
      if (customers.length !== 1) {
        throw new BadRequestException(
          'Multiple customers with that phone number exist'
        );
      }
      await this.hardDeleteCustomer(customers[0].id, correlationId);
    }

    // Sync: set isTestUser=false on customers with matching phone before deleting test_customers row
    await this.prismaService.customer.updateMany({
      where: { phoneNumber: { in: phoneVariants } },
      data: { isTestUser: false },
    });

    await this.prismaService.testCustomer.delete({
      where: { id },
    });
  }

  /**
   * Hard-delete a customer and all related records in cascade order.
   */
  private async hardDeleteCustomer(
    customerId: string,
    correlationId: string
  ): Promise<void> {
    this.logger.log(`[${correlationId}] Hard-deleting customer: ${customerId}`);

    await this.prismaService.$transaction(async (tx) => {
      // Get policy IDs for this customer
      const policies = await tx.policy.findMany({
        where: { customerId },
        select: { id: true },
      });
      const policyIds = policies.map((p) => p.id);

      // Get registration IDs for this customer
      const registrations = await tx.agentRegistration.findMany({
        where: { customerId },
        select: { id: true },
      });
      const registrationIds = registrations.map((r) => r.id);

      // Get dependant IDs
      const dependants = await tx.dependant.findMany({
        where: { customerId },
        select: { id: true },
      });
      const dependantIds = dependants.map((d) => d.id);

      // Get policy payment IDs for this customer's policies
      const policyPayments = await tx.policyPayment.findMany({
        where: { policyId: { in: policyIds } },
        select: { id: true },
      });
      const policyPaymentIds = policyPayments.map((pp) => pp.id);

      // 1. missing_requirements
      await tx.missingRequirement.deleteMany({ where: { customerId } });

      // 2. ba_payouts (for this customer's registrations)
      if (registrationIds.length > 0) {
        await tx.bAPayout.deleteMany({
          where: { registrationId: { in: registrationIds } },
        });
      }

      // 3. agent_registrations
      await tx.agentRegistration.deleteMany({ where: { customerId } });

      // 4. beneficiaries
      await tx.beneficiary.deleteMany({ where: { customerId } });

      // 5. policy_member_dependants
      if (dependantIds.length > 0) {
        await tx.policyMemberDependant.deleteMany({
          where: { dependantId: { in: dependantIds } },
        });
      }

      // 6. dependants
      await tx.dependant.deleteMany({ where: { customerId } });

      // 7. package_scheme_customers
      await tx.packageSchemeCustomer.deleteMany({ where: { customerId } });

      // 8. partner_customers
      await tx.partnerCustomer.deleteMany({ where: { customerId } });

      // 9. addresses
      await tx.address.deleteMany({ where: { customerId } });

      // 10. onboarding_progress
      await tx.onboardingProgress.deleteMany({ where: { customerId } });

      // 11. kyc_verifications
      await tx.kYCVerification.deleteMany({ where: { customerId } });

      // 12. messaging_deliveries (cascades to messaging_attachments)
      await tx.messagingDelivery.deleteMany({
        where: {
          OR: [
            { customerId },
            { policyId: { in: policyIds } },
          ],
        },
      });

      // 13. postpaid_scheme_payment_items
      if (policyPaymentIds.length > 0) {
        await tx.postpaidSchemePaymentItem.deleteMany({
          where: { policyPaymentId: { in: policyPaymentIds } },
        });
      }

      // 14. policy_payments
      await tx.policyPayment.deleteMany({
        where: { policyId: { in: policyIds } },
      });

      // 15. policy_tags
      await tx.policyTag.deleteMany({
        where: { policyId: { in: policyIds } },
      });

      // 16. policies
      await tx.policy.deleteMany({ where: { customerId } });

      // 17. policy_member_principals
      await tx.policyMemberPrincipal.deleteMany({ where: { customerId } });

      // 18. customers
      await tx.customer.delete({ where: { id: customerId } });
    });
  }

  /**
   * Get phone number variants for matching across formats stored in DB.
   * test_customers stores international (254...); customers store national
   * (0...) or international (254...). We never store 9-digit format.
   */
  private getPhoneVariantsForMatch(phone: string): string[] {
    const variants = new Set<string>([phone]);

    // Get the 9-digit subscriber part to generate national/international variants
    const digitsOnly = phone.replace(/\D/g, '');
    let nineDigits: string | null = null;

    if (digitsOnly.startsWith('254') && digitsOnly.length === 12) {
      nineDigits = digitsOnly.substring(3); // 254XXXXXXXXX -> XXXXXXXX
    } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
      nineDigits = digitsOnly.substring(1); // 0XXXXXXXXX -> XXXXXXXX
    }

    if (nineDigits) {
      variants.add(`254${nineDigits}`);
      variants.add(`0${nineDigits}`);
      variants.add(`+254${nineDigits}`);
    }

    return Array.from(variants);
  }

  /**
   * Check if a phone number exists in test_customers (for customer creation)
   */
  async isTestPhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
      const normalized = normalizePhoneNumber(phoneNumber);
      const found = await this.prismaService.testCustomer.findUnique({
        where: { phoneNumber: normalized },
      });
      return !!found;
    } catch {
      return false;
    }
  }
}
