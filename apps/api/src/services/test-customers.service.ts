import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestCustomerDto } from '../dto/test-customers';
import { normalizePhoneNumber } from '../utils/phone-number.util';
import { ValidationException } from '../exceptions/validation.exception';

export interface TestCustomerListOptions {
  page?: number;
  pageSize?: number;
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

    return created;
  }

  /**
   * Delete a test customer
   */
  async delete(id: string, correlationId: string): Promise<void> {
    this.logger.log(`[${correlationId}] Deleting test customer: ${id}`);

    const existing = await this.prismaService.testCustomer.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Test customer with ID ${id} not found`);
    }

    await this.prismaService.testCustomer.delete({
      where: { id },
    });
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
