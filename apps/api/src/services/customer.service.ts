import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Customer, CustomerData } from '../entities/customer.entity';
import { PartnerCustomer, PartnerCustomerData } from '../entities/partner-customer.entity';
import { CustomerMapper } from '../mappers/customer.mapper';
import { PartnerCustomerMapper } from '../mappers/partner-customer.mapper';
import { CreatePrincipalMemberRequestDto } from '../dto/principal-member/create-principal-member-request.dto';
import { CreatePrincipalMemberResponseDto } from '../dto/principal-member/create-principal-member-response.dto';
import { PrincipalMemberDto } from '../dto/principal-member/principal-member.dto';
import { AddDependantsRequestDto } from '../dto/dependants/add-dependants-request.dto';
import { AddDependantsResponseDto } from '../dto/dependants/add-dependants-response.dto';
import { GetDependantsResponseDto } from '../dto/dependants/get-dependants-response.dto';
import { AddBeneficiariesRequestDto } from '../dto/beneficiaries/add-beneficiaries-request.dto';
import { AddBeneficiariesResponseDto } from '../dto/beneficiaries/add-beneficiaries-response.dto';
import { GetBeneficiariesResponseDto } from '../dto/beneficiaries/get-beneficiaries-response.dto';
import { SharedMapperUtils } from '../mappers/shared.mapper.utils';
import { CustomerDetailResponseDto, CustomerDetailDataDto } from '../dto/customers/customer-detail.dto';
import { CustomerPoliciesResponseDto, CustomerPaymentsResponseDto, PolicyOptionDto, PaymentDto } from '../dto/customers/customer-payments-filter.dto';
import { UpdateCustomerDto } from '../dto/customers/update-customer.dto';
import { UpdateDependantDto } from '../dto/dependants/update-dependant.dto';
import { UpdateBeneficiaryDto } from '../dto/beneficiaries/update-beneficiary.dto';

/**
 * Customer Service
 *
 * Handles all customer-related business logic with proper partner scoping
 * Ensures that partners can only access their own customers
 *
 * Features:
 * - Customer creation with partner relationship
 * - Customer retrieval scoped to partner
 * - Partner-customer relationship management
 * - Business validation and error handling
 */
@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  /**
   * Calculate if child requires verification (age 18-24 years old)
   */
  private calculateChildVerificationRequired(dateOfBirth: Date | null | undefined): boolean {
    if (!dateOfBirth) return false;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18 && age < 25;
  }

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Create a new customer with partner relationship
   * @param createRequest - Customer creation request
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID for tracing
   * @param skipPartnerValidation - Skip partner validation if already validated (e.g., by API key middleware)
   * @returns Customer creation response
   */
  async createCustomer(
    createRequest: CreatePrincipalMemberRequestDto,
    partnerId: number,
    correlationId: string,
    skipPartnerValidation: boolean = false,
    userId?: string
  ): Promise<CreatePrincipalMemberResponseDto> {
    this.logger.log(`[${correlationId}] Creating customer for partner ${partnerId}`);

    try {
      // Validate partner exists and is active (skip if already validated by middleware)
      if (!skipPartnerValidation) {
        const partner = await this.prismaService.partner.findFirst({
          where: {
            id: partnerId,
            isActive: true,
          },
        });

        if (!partner) {
          throw new BadRequestException('Partner not found or inactive');
        }
      }

      // Check if partner-customer relationship already exists
      this.logger.log(`[${correlationId}] Checking for existing partner customer: partnerId=${partnerId}, partnerCustomerId=${createRequest.principalMember.partnerCustomerId}`);
      const existingPartnerCustomer = await this.prismaService.partnerCustomer.findFirst({
        where: {
          partnerId: partnerId,
          partnerCustomerId: createRequest.principalMember.partnerCustomerId,
        },
      });

      if (existingPartnerCustomer) {
        throw new BadRequestException('Customer with this partner customer ID already exists');
      }

      // Create customer entity
      const customerEntity = CustomerMapper.fromPrincipalMemberDto(
        createRequest.principalMember,
        Number(partnerId)
      );

      // Collect all validation errors
      const validationErrors: Record<string, string> = {};

      // Validate customer entity
      const validationResult = customerEntity.validateBeforeSave();
      if (!validationResult.valid) {
        // Add entity validation errors
        validationResult.errors.forEach(error => {
          // Extract field name from error message if possible
          const fieldMatch = error.match(/^(\w+)\s+(.+)$/);
          if (fieldMatch) {
            validationErrors[fieldMatch[1]] = fieldMatch[2];
          } else {
            validationErrors['general'] = error;
          }
        });
      }

      // Pre-save validation: Check for email uniqueness
      if (customerEntity.email) {
        const existingCustomerWithEmail = await this.prismaService.customer.findFirst({
          where: { email: customerEntity.email },
        });
        if (existingCustomerWithEmail) {
          validationErrors['email'] = 'Email address already exists';
        }
      }

      // Pre-save validation: Check for idType+idNumber uniqueness
      const existingCustomerWithId = await this.prismaService.customer.findFirst({
        where: {
          idType: customerEntity.idType,
          idNumber: customerEntity.idNumber,
        },
      });
      if (existingCustomerWithId) {
        validationErrors['id_number'] = 'ID number already exists for this ID type';
      }

      // If there are any validation errors, throw exception with all errors
      if (Object.keys(validationErrors).length > 0) {
        throw ValidationException.withMultipleErrors(validationErrors, ErrorCodes.VALIDATION_ERROR);
      }

      // Create customer in database
      const createdCustomer = await this.prismaService.customer.create({
        data: {
          firstName: customerEntity.firstName,
          middleName: customerEntity.middleName,
          lastName: customerEntity.lastName,
          email: customerEntity.email || null,
          phoneNumber: customerEntity.phoneNumber,
          dateOfBirth: customerEntity.dateOfBirth,
          gender: customerEntity.gender,
          idType: customerEntity.idType,
          idNumber: customerEntity.idNumber,
          status: customerEntity.status,
          onboardingStep: customerEntity.onboardingStep,
          createdByPartnerId: partnerId,
          createdBy: userId || null, // User ID who created the customer
        },
      });

      // Create partner-customer relationship
      const partnerCustomerEntity = new PartnerCustomer({
        id: 0, // Will be generated by database
        partnerId: partnerId,
        customerId: createdCustomer.id,
        partnerCustomerId: createRequest.principalMember.partnerCustomerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Validate partner-customer entity
      const partnerCustomerValidation = partnerCustomerEntity.validateBeforeSave();
      if (!partnerCustomerValidation.valid) {
        // Rollback customer creation
        await this.prismaService.customer.delete({
          where: { id: createdCustomer.id },
        });
        throw new BadRequestException(partnerCustomerValidation.errors.join(', '));
      }

      const createdPartnerCustomer = await this.prismaService.partnerCustomer.create({
        data: {
          partnerId: partnerCustomerEntity.partnerId,
          customerId: partnerCustomerEntity.customerId,
          partnerCustomerId: partnerCustomerEntity.partnerCustomerId,
        },
      });

      // Create package scheme customer relationship (replacement for partner_customers)
      // Use provided packageSchemeId or default to 1 (MfanisiGo -> OOD Drivers)
      const packageSchemeId = createRequest.packageSchemeId ?? 1;

      // Insert into package_scheme_customers table immediately after partner_customers
      try {
        await this.prismaService.packageSchemeCustomer.create({
          data: {
            packageSchemeId: packageSchemeId,
            partnerId: partnerId,
            customerId: createdCustomer.id,
            partnerCustomerId: createRequest.principalMember.partnerCustomerId,
          },
        });
        this.logger.log(`[${correlationId}] Package scheme customer created successfully`);
      } catch (error) {
        this.logger.error(`[${correlationId}] Failed to create package scheme customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Don't throw - allow the rest of customer creation to continue
      }

      // Create dependants and beneficiaries if provided
      let createdChildren: any[] = [];
      let createdSpouses: any[] = [];
      let createdBeneficiaries: any[] = [];

      if (createRequest.children && createRequest.children.length > 0) {
        const childrenData = createRequest.children.map(child => {
          const dateOfBirth = child.dateOfBirth ? new Date(child.dateOfBirth) : null;
          return {
            customerId: createdCustomer.id,
            firstName: child.firstName,
            middleName: child.middleName || null,
            lastName: child.lastName,
            dateOfBirth,
            gender: child.gender.toUpperCase() as any,
            idType: child.idType ? SharedMapperUtils.mapIdTypeFromDto(child.idType) as any : null,
            idNumber: child.idNumber || null,
            relationship: 'CHILD' as const,
            verificationRequired: this.calculateChildVerificationRequired(dateOfBirth),
            createdByPartnerId: partnerId,
          };
        });

        await this.prismaService.dependant.createMany({
          data: childrenData,
        });

        // Get created children with IDs
        createdChildren = await this.prismaService.dependant.findMany({
          where: {
            customerId: createdCustomer.id,
            relationship: 'CHILD'
          },
          orderBy: { createdAt: 'desc' },
          take: createRequest.children.length,
        });
      }

      if (createRequest.spouses && createRequest.spouses.length > 0) {
        const spousesData = createRequest.spouses.map((spouse) => {
          const mappedIdType = SharedMapperUtils.mapIdTypeFromDto(spouse.idType);
          const trimmedIdNumber = spouse.idNumber?.trim();

          return {
            customerId: createdCustomer.id,
            firstName: spouse.firstName,
            middleName: spouse.middleName || null,
            lastName: spouse.lastName,
            dateOfBirth: spouse.dateOfBirth ? new Date(spouse.dateOfBirth) : null,
            gender: spouse.gender.toUpperCase() as any,
            email: spouse.email || null,
            phoneNumber: spouse.phoneNumber || null,
            idType: trimmedIdNumber ? (mappedIdType as any) : null,
            idNumber: trimmedIdNumber || null,
            relationship: 'SPOUSE' as const,
            verificationRequired: false,
            createdByPartnerId: partnerId,
          };
        });

        await this.prismaService.dependant.createMany({
          data: spousesData,
        });

        // Get created spouses with IDs
        createdSpouses = await this.prismaService.dependant.findMany({
          where: {
            customerId: createdCustomer.id,
            relationship: 'SPOUSE'
          },
          orderBy: { createdAt: 'desc' },
          take: createRequest.spouses.length,
        });
      }

      if (createRequest.beneficiaries && createRequest.beneficiaries.length > 0) {
        const beneficiariesData = createRequest.beneficiaries.map((beneficiary) => {
          const trimmedIdNumber = beneficiary.idNumber?.trim();
          const mappedIdType = SharedMapperUtils.mapIdTypeFromDto(beneficiary.idType);

          return {
            customerId: createdCustomer.id,
            firstName: beneficiary.firstName,
            middleName: beneficiary.middleName || null,
            lastName: beneficiary.lastName,
            dateOfBirth: new Date(beneficiary.dateOfBirth),
            gender: beneficiary.gender.toUpperCase() as any,
            idType: trimmedIdNumber ? (mappedIdType as any) : null,
            idNumber: trimmedIdNumber || null,
            relationship: beneficiary.relationship,
            percentage: beneficiary.percentage,
            createdByPartnerId: partnerId,
          };
        });

        await this.prismaService.beneficiary.createMany({
          data: beneficiariesData,
        });

        // Get created beneficiaries with IDs
        createdBeneficiaries = await this.prismaService.beneficiary.findMany({
          where: { customerId: createdCustomer.id },
          orderBy: { createdAt: 'desc' },
          take: createRequest.beneficiaries.length,
        });
      }

      // Create customer entity from database result
      const customer = Customer.fromPrismaData(createdCustomer);

      this.logger.log(`[${correlationId}] Customer created successfully: ${customer.id}`);

      // Return response using mapper with dependants and beneficiaries
      return CustomerMapper.toCreatePrincipalMemberResponseDto(
        customer,
        createRequest.principalMember.partnerCustomerId,
        correlationId,
        createRequest.referredBy,
        createdChildren,
        createdSpouses,
        createdBeneficiaries
      );
    } catch (error) {
      this.logger.error(`[${correlationId}] Error creating customer: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get customer by ID scoped to partner
   * @param customerId - Customer ID
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID for tracing
   * @returns Customer data
   */
  async getCustomerById(
    customerId: string,
    partnerId: number,
    correlationId: string
  ): Promise<PrincipalMemberDto> {
    this.logger.log(`[${correlationId}] Getting customer ${customerId} for partner ${partnerId}`);

    try {
      // Get customer with partner relationship validation
      const customer = await this.prismaService.customer.findFirst({
        where: {
          id: customerId,
          createdByPartnerId: partnerId,
          partnerCustomers: {
            some: {
              partnerId: partnerId,
            },
          },
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found or not accessible to this partner');
      }

      // Create customer entity
      const customerEntity = Customer.fromPrismaData(customer);

      this.logger.log(`[${correlationId}] Customer retrieved successfully: ${customerId}`);

      // Return customer data using mapper
      return CustomerMapper.toPrincipalMemberDto(customerEntity);
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting customer: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get all customers for a partner
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID for tracing
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10, max: 100)
   * @returns Paginated customer list
   */
  async getCustomersByPartner(
    partnerId: number,
    correlationId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    customers: PrincipalMemberDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    this.logger.log(`[${correlationId}] Getting customers for partner ${partnerId}, page ${page}, limit ${limit}`);

    try {
      // Validate pagination parameters
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(100, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      // Get customers with partner relationship validation
      const [customers, total] = await Promise.all([
        this.prismaService.customer.findMany({
          where: {
            createdByPartnerId: partnerId,
            partnerCustomers: {
              some: {
                partnerId: partnerId,
              },
            },
          },
          skip,
          take: validatedLimit,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prismaService.customer.count({
          where: {
            createdByPartnerId: partnerId,
            partnerCustomers: {
              some: {
                partnerId: partnerId,
              },
            },
          },
        }),
      ]);

      // Convert to entities and DTOs
      const customerEntities = customers.map(customer => Customer.fromPrismaData(customer));
      const customerDtos = customerEntities.map(customer => CustomerMapper.toPrincipalMemberDto(customer));

      const totalPages = Math.ceil(total / validatedLimit);

      this.logger.log(`[${correlationId}] Retrieved ${customers.length} customers for partner ${partnerId}`);

      return {
        customers: customerDtos,
        pagination: {
          page: validatedPage,
          limit: validatedLimit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting customers: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Check if customer exists and is accessible to partner
   * @param customerId - Customer ID
   * @param partnerId - Partner ID
   * @returns boolean
   */
  async customerExistsForPartner(customerId: string, partnerId: number): Promise<boolean> {
    const customer = await this.prismaService.customer.findFirst({
      where: {
        id: customerId,
        createdByPartnerId: partnerId,
        partnerCustomers: {
          some: {
            partnerId: partnerId,
          },
        },
      },
    });

    return !!customer;
  }

  /**
   * Get customer count for partner
   * @param partnerId - Partner ID
   * @returns number of customers
   */
  async getCustomerCountForPartner(partnerId: number): Promise<number> {
    return this.prismaService.customer.count({
      where: {
        createdByPartnerId: partnerId,
        partnerCustomers: {
          some: {
            partnerId: partnerId,
          },
        },
      },
    });
  }

  /**
   * Add dependants (children and/or spouses) to an existing customer
   * @param customerId - Customer ID
   * @param addRequest - Dependants addition request
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID for tracing
   * @returns Dependants addition response
   */
  async addDependants(
    customerId: string,
    addRequest: AddDependantsRequestDto,
    partnerId: number,
    correlationId: string
  ): Promise<AddDependantsResponseDto> {
    this.logger.log(`[${correlationId}] Adding dependants to customer ${customerId} for partner ${partnerId}`);

    try {
      // Validate that at least one dependant is provided
      if ((!addRequest.children || addRequest.children.length === 0) &&
          (!addRequest.spouses || addRequest.spouses.length === 0)) {
        throw ValidationException.forField('dependants', 'At least one child or spouse must be provided', ErrorCodes.NO_DEPENDANTS_PROVIDED);
      }

      // Validate customer exists and belongs to partner
      const customer = await this.prismaService.customer.findFirst({
        where: {
          id: customerId,
          createdByPartnerId: partnerId,
          partnerCustomers: {
            some: {
              partnerId: partnerId,
            },
          },
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found or not accessible to this partner');
      }

      // Get partner customer ID for response
      const partnerCustomer = await this.prismaService.partnerCustomer.findFirst({
        where: {
          customerId: customerId,
          partnerId: partnerId,
        },
      });

      if (!partnerCustomer) {
        throw new NotFoundException('Partner customer relationship not found');
      }

      // Use transaction to add all dependants atomically
      const result = await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
        const addedDependants: any[] = [];
        let childrenAdded = 0;
        let spousesAdded = 0;

        // Add children if provided
        if (addRequest.children && addRequest.children.length > 0) {
        const childrenData = addRequest.children.map(child => {
          const dateOfBirth = child.dateOfBirth ? new Date(child.dateOfBirth) : null;
          return {
            customerId: customerId,
            firstName: child.firstName,
            middleName: child.middleName || null,
            lastName: child.lastName,
            dateOfBirth,
            gender: child.gender.toUpperCase() as any,
            idType: child.idType ? SharedMapperUtils.mapIdTypeFromDto(child.idType) as any : null,
            idNumber: child.idNumber || null,
            relationship: 'CHILD' as const,
            verificationRequired: this.calculateChildVerificationRequired(dateOfBirth),
            createdByPartnerId: partnerId,
          };
        });

          const createdChildren = await tx.dependant.createMany({
            data: childrenData,
          });

          // Get the created children with their IDs
          const childrenWithIds = await tx.dependant.findMany({
            where: {
              customerId: customerId,
              relationship: 'CHILD',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: addRequest.children.length,
          });

          childrenAdded = createdChildren.count;
          addedDependants.push(...childrenWithIds.map((child: any) => ({
            dependantId: child.id,
            relationship: 'child' as const,
            firstName: child.firstName,
            lastName: child.lastName,
            dateOfBirth: child.dateOfBirth?.toISOString().split('T')[0] ?? null,
            gender: child.gender,
          })));
        }

        // Add spouses if provided
        if (addRequest.spouses && addRequest.spouses.length > 0) {
          const spousesData = addRequest.spouses.map((spouse) => {
            const trimmedIdNumber = spouse.idNumber?.trim();
            const mappedIdType = SharedMapperUtils.mapIdTypeFromDto(spouse.idType);

            return {
              customerId: customerId,
              firstName: spouse.firstName,
              middleName: spouse.middleName || null,
              lastName: spouse.lastName,
              dateOfBirth: spouse.dateOfBirth ? new Date(spouse.dateOfBirth) : null,
              gender: spouse.gender.toUpperCase() as any,
              email: spouse.email || null,
              phoneNumber: spouse.phoneNumber || null,
              idType: trimmedIdNumber ? (mappedIdType as any) : null,
              idNumber: trimmedIdNumber || null,
              relationship: 'SPOUSE' as const,
              verificationRequired: false,
              createdByPartnerId: partnerId,
            };
          });

          const createdSpouses = await tx.dependant.createMany({
            data: spousesData,
          });

          // Get the created spouses with their IDs
          const spousesWithIds = await tx.dependant.findMany({
            where: {
              customerId: customerId,
              relationship: 'SPOUSE',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: addRequest.spouses.length,
          });

          spousesAdded = createdSpouses.count;
          addedDependants.push(...spousesWithIds.map((spouse: any) => ({
            dependantId: spouse.id,
            relationship: 'spouse' as const,
            firstName: spouse.firstName,
            lastName: spouse.lastName,
            dateOfBirth: spouse.dateOfBirth?.toISOString().split('T')[0] ?? null,
            gender: spouse.gender,
            email: spouse.email,
            idType: SharedMapperUtils.mapIdTypeToDto(spouse.idType),
            idNumber: spouse.idNumber ?? null,
          })));
        }

        return {
          partnerCustomerId: partnerCustomer.partnerCustomerId,
          totalProcessed: childrenAdded + spousesAdded,
          childrenAdded,
          spousesAdded,
          addedDependants,
        };
      });

      this.logger.log(`[${correlationId}] Successfully added ${result.totalProcessed} dependants to customer ${customerId}`);

      return {
        status: 201,
        correlationId: correlationId,
        message: 'Dependants added successfully',
        data: {
          partnerCustomerId: result.partnerCustomerId,
          dependants: {
            totalProcessed: result.totalProcessed,
            childrenAdded: result.childrenAdded,
            spousesAdded: result.spousesAdded,
            success: true,
            message: `${result.childrenAdded} children and ${result.spousesAdded} spouses added successfully`,
            addedDependants: result.addedDependants,
          },
        },
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error adding dependants: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get all dependants (children and spouses) for a customer
   * @param customerId - Customer ID
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID for tracing
   * @returns Dependants retrieval response
   */
  async getDependants(
    customerId: string,
    partnerId: number,
    correlationId: string
  ): Promise<GetDependantsResponseDto> {
    this.logger.log(`[${correlationId}] Getting dependants for customer ${customerId} for partner ${partnerId}`);

    try {
      // Validate customer exists and belongs to partner
      const customer = await this.prismaService.customer.findFirst({
        where: {
          id: customerId,
          createdByPartnerId: partnerId,
          partnerCustomers: {
            some: {
              partnerId: partnerId,
            },
          },
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found or not accessible to this partner');
      }

      // Get partner customer ID for response
      const partnerCustomer = await this.prismaService.partnerCustomer.findFirst({
        where: {
          customerId: customerId,
          partnerId: partnerId,
        },
      });

      if (!partnerCustomer) {
        throw new NotFoundException('Partner customer relationship not found');
      }

      // Get children and spouses in parallel
      const [children, spouses] = await Promise.all([
        this.prismaService.dependant.findMany({
          where: {
            customerId: customerId,
            relationship: 'CHILD'
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prismaService.dependant.findMany({
          where: {
            customerId: customerId,
            relationship: 'SPOUSE'
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      // Transform children data
      const childrenWithIds = children.map((child: any) => ({
        dependantId: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        dateOfBirth: child.dateOfBirth?.toISOString().split('T')[0] ?? null,
        gender: child.gender,
        idType: child.idType,
        idNumber: child.idNumber,
      }));

      // Transform spouses data
      const spousesWithIds = spouses.map((spouse: any) => ({
        dependantId: spouse.id,
        firstName: spouse.firstName,
        lastName: spouse.lastName,
        dateOfBirth: spouse.dateOfBirth?.toISOString().split('T')[0] ?? null,
        gender: spouse.gender,
        email: spouse.email,
        idType: spouse.idType,
        idNumber: spouse.idNumber,
      }));

      const totalDependants = childrenWithIds.length + spousesWithIds.length;

      this.logger.log(`[${correlationId}] Retrieved ${totalDependants} dependants for customer ${customerId}`);

      return {
        status: 200,
        correlationId: correlationId,
        message: 'Dependants retrieved successfully',
        data: {
          partnerCustomerId: partnerCustomer.partnerCustomerId,
          dependants: {
            children: childrenWithIds,
            spouses: spousesWithIds,
            totalDependants,
          },
        },
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting dependants: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Add beneficiaries to an existing customer
   * @param customerId - Customer ID
   * @param addRequest - Beneficiaries addition request
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID for tracing
   * @returns Beneficiaries addition response
   */
  async addBeneficiaries(
    customerId: string,
    addRequest: AddBeneficiariesRequestDto,
    partnerId: number,
    correlationId: string
  ): Promise<AddBeneficiariesResponseDto> {
    this.logger.log(`[${correlationId}] Adding beneficiaries to customer ${customerId} for partner ${partnerId}`);

    try {
      // Validate that at least one beneficiary is provided
      if (!addRequest.beneficiaries || addRequest.beneficiaries.length === 0) {
        throw ValidationException.forField('beneficiaries', 'At least one beneficiary must be provided', ErrorCodes.NO_BENEFICIARIES_PROVIDED);
      }

      // Validate relationship description for "other" relationships
      const validationErrors: Record<string, string> = {};
      addRequest.beneficiaries.forEach((beneficiary, index) => {
        if (beneficiary.relationship === 'other' && !beneficiary.relationshipDescription) {
          validationErrors[`beneficiaries[${index}].relationshipDescription`] = 'Relationship description is required when relationship is "other"';
        }
      });

      if (Object.keys(validationErrors).length > 0) {
        throw ValidationException.withMultipleErrors(validationErrors, ErrorCodes.VALIDATION_ERROR);
      }

      // Validate customer exists and belongs to partner
      const customer = await this.prismaService.customer.findFirst({
        where: {
          id: customerId,
          createdByPartnerId: partnerId,
          partnerCustomers: {
            some: {
              partnerId: partnerId,
            },
          },
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found or not accessible to this partner');
      }

      // Get partner customer ID for response
      const partnerCustomer = await this.prismaService.partnerCustomer.findFirst({
        where: {
          customerId: customerId,
          partnerId: partnerId,
        },
      });

      if (!partnerCustomer) {
        throw new NotFoundException('Partner customer relationship not found');
      }

      // Use transaction to add all beneficiaries atomically
      const result = await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
        const addedBeneficiaries: any[] = [];
        let beneficiariesAdded = 0;

        const beneficiariesData = addRequest.beneficiaries.map((beneficiary) => {
          const trimmedIdNumber = beneficiary.idNumber?.trim();
          const mappedIdType = SharedMapperUtils.mapIdTypeFromDto(beneficiary.idType);

          return {
            customerId: customerId,
            firstName: beneficiary.firstName,
            middleName: beneficiary.middleName || null,
            lastName: beneficiary.lastName,
            dateOfBirth: beneficiary.dateOfBirth ? new Date(beneficiary.dateOfBirth) : null,
            gender: beneficiary.gender.toUpperCase() as any,
            email: beneficiary.email || null,
            phoneNumber: beneficiary.phoneNumber || null,
            idType: trimmedIdNumber ? (mappedIdType as any) : null,
            idNumber: trimmedIdNumber || null,
            relationship: beneficiary.relationship,
            relationshipDescription: beneficiary.relationshipDescription || null,
            percentage: beneficiary.percentage,
            createdByPartnerId: partnerId,
          };
        });

        const createdBeneficiaries = await tx.beneficiary.createMany({
          data: beneficiariesData,
        });

        // Get the created beneficiaries with their IDs
        const beneficiariesWithIds = await tx.beneficiary.findMany({
          where: {
            customerId: customerId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: addRequest.beneficiaries.length,
        });

        beneficiariesAdded = createdBeneficiaries.count;
        addedBeneficiaries.push(
          ...beneficiariesWithIds.map((beneficiary: any) => ({
            beneficiaryId: beneficiary.id,
            firstName: beneficiary.firstName,
            lastName: beneficiary.lastName,
            dateOfBirth: beneficiary.dateOfBirth?.toISOString().split('T')[0] ?? null,
            gender: beneficiary.gender,
            email: beneficiary.email,
            phoneNumber: beneficiary.phoneNumber,
            idType: SharedMapperUtils.mapIdTypeToDto(beneficiary.idType),
            idNumber: beneficiary.idNumber ?? undefined,
            relationship: beneficiary.relationship,
            relationshipDescription: beneficiary.relationshipDescription,
            percentage: beneficiary.percentage,
          }))
        );

        return {
          partnerCustomerId: partnerCustomer.partnerCustomerId,
          totalProcessed: beneficiariesAdded,
          addedBeneficiaries,
        };
      });

      this.logger.log(`[${correlationId}] Successfully added ${result.totalProcessed} beneficiaries to customer ${customerId}`);

      return {
        status: 201,
        correlationId: correlationId,
        message: 'Beneficiaries added successfully',
        data: {
          partnerCustomerId: result.partnerCustomerId,
          beneficiaries: {
            totalProcessed: result.totalProcessed,
            success: true,
            message: `${result.totalProcessed} beneficiaries added successfully`,
            addedBeneficiaries: result.addedBeneficiaries,
          },
        },
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error adding beneficiaries: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get all beneficiaries for a customer
   * @param customerId - Customer ID
   * @param partnerId - Partner ID from API key validation
   * @param correlationId - Correlation ID for tracing
   * @returns Beneficiaries retrieval response
   */
  async getBeneficiaries(
    customerId: string,
    partnerId: number,
    correlationId: string
  ): Promise<GetBeneficiariesResponseDto> {
    this.logger.log(`[${correlationId}] Getting beneficiaries for customer ${customerId} for partner ${partnerId}`);

    try {
      // Validate customer exists and belongs to partner
      const customer = await this.prismaService.customer.findFirst({
        where: {
          id: customerId,
          createdByPartnerId: partnerId,
          partnerCustomers: {
            some: {
              partnerId: partnerId,
            },
          },
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found or not accessible to this partner');
      }

      // Get partner customer ID for response
      const partnerCustomer = await this.prismaService.partnerCustomer.findFirst({
        where: {
          customerId: customerId,
          partnerId: partnerId,
        },
      });

      if (!partnerCustomer) {
        throw new NotFoundException('Partner customer relationship not found');
      }

      // Get beneficiaries
      const beneficiaries = await this.prismaService.beneficiary.findMany({
        where: { customerId: customerId },
        orderBy: { createdAt: 'asc' },
      });

      // Transform beneficiaries data
      const beneficiariesWithIds = beneficiaries.map((beneficiary: any) => ({
        beneficiaryId: beneficiary.id,
        firstName: beneficiary.firstName,
        lastName: beneficiary.lastName,
        dateOfBirth: beneficiary.dateOfBirth?.toISOString().split('T')[0] ?? null,
        gender: beneficiary.gender,
        email: beneficiary.email,
        phoneNumber: beneficiary.phoneNumber,
        idType: beneficiary.idType,
        idNumber: beneficiary.idNumber,
        relationship: beneficiary.relationship,
        relationshipDescription: beneficiary.relationshipDescription,
        percentage: beneficiary.percentage,
      }));

      const totalBeneficiaries = beneficiariesWithIds.length;

      this.logger.log(`[${correlationId}] Retrieved ${totalBeneficiaries} beneficiaries for customer ${customerId}`);

      return {
        status: 200,
        correlationId: correlationId,
        message: 'Beneficiaries retrieved successfully',
        data: {
          partnerCustomerId: partnerCustomer.partnerCustomerId,
          beneficiaries: beneficiariesWithIds,
          totalBeneficiaries,
        },
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting beneficiaries: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get brand ambassador's customer registrations with pagination and filtering
   * Filters by createdBy (userId) to show only customers created by the logged-in user
   */
  async getBrandAmbassadorRegistrations(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    fromDate?: string,
    toDate?: string,
    correlationId: string = 'unknown'
  ) {
    try {
      this.logger.log(`[${correlationId}] Getting brand ambassador registrations for user ${userId}, page ${page}, pageSize ${pageSize}`);

      const skip = (page - 1) * pageSize;

      // Build date filter
      const dateFilter: any = {};
      if (fromDate) {
        dateFilter.gte = new Date(fromDate);
      }
      if (toDate) {
        dateFilter.lte = new Date(toDate);
      }

      const whereClause: any = {
        createdBy: userId, // Filter by user ID who created the customer
      };

      if (Object.keys(dateFilter).length > 0) {
        whereClause.createdAt = dateFilter;
      }

      // Get customers with pagination
      const [customers, totalCount] = await Promise.all([
        this.prismaService.customer.findMany({
          where: whereClause,
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            phoneNumber: true,
            gender: true,
            createdAt: true,
            idType: true,
            idNumber: true,
            hasMissingRequirements: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: pageSize,
        }),
        this.prismaService.customer.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      // Transform data for brand ambassador view (unmasked data as requested)
      const transformedCustomers = customers.map(customer => ({
        id: customer.id,
        firstName: customer.firstName,
        middleName: customer.middleName ?? undefined,
        lastName: customer.lastName,
        phoneNumber: customer.phoneNumber, // Unmasked
        gender: customer.gender?.toLowerCase() || 'unknown',
        createdAt: customer.createdAt.toISOString(),
        idType: customer.idType,
        idNumber: customer.idNumber, // Unmasked
        hasMissingRequirements: customer.hasMissingRequirements,
      }));

      return {
        data: transformedCustomers,
        pagination: {
          page,
          pageSize,
          totalItems: totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting brand ambassador registrations: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get registrations chart data (time-series)
   * @param userId - Optional user ID to filter by specific agent
   * @param period - Time period: '7d', '30d', or '90d'
   * @param correlationId - Correlation ID for tracing
   */
  async getRegistrationsChartData(
    userId: string | undefined,
    period: '7d' | '30d' | '90d',
    correlationId: string = 'unknown'
  ) {
    try {
      this.logger.log(`[${correlationId}] Getting registrations chart data for period ${period}, userId: ${userId ?? 'all'}`);

      // Calculate date range based on period
      const now = new Date();
      const startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
      }

      startDate.setUTCHours(0, 0, 0, 0);

      // Build where clause
      const whereClause: any = {
        createdAt: {
          gte: startDate,
          lte: now,
        },
      };

      // Filter by userId if provided (for agent view)
      if (userId) {
        whereClause.createdBy = userId;
      }

      // Get all registrations in the period
      const registrations = await this.prismaService.customer.findMany({
        where: whereClause,
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Group by date
      const dailyCounts = new Map<string, number>();

      // Initialize all dates in range with 0
      const currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateKey = currentDate.toISOString().split('T')[0];
        dailyCounts.set(dateKey, 0);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Count registrations per day
      registrations.forEach(reg => {
        const dateKey = reg.createdAt.toISOString().split('T')[0];
        const currentCount = dailyCounts.get(dateKey) ?? 0;
        dailyCounts.set(dateKey, currentCount + 1);
      });

      // Convert to array format
      const data = Array.from(dailyCounts.entries())
        .map(([date, count]) => ({
          date,
          count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const total = registrations.length;

      this.logger.log(`[${correlationId}] Retrieved chart data: ${data.length} data points, total: ${total}`);

      return {
        data,
        total,
        period,
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting registrations chart data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get Brand Ambassador dashboard statistics
   */
  async getBrandAmbassadorDashboardStats(partnerId: number, correlationId: string = 'unknown') {
    try {
      this.logger.log(`[${correlationId}] Getting brand ambassador dashboard stats for partner ${partnerId}`);

      // Get date ranges
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // This week (Monday to Sunday)
      const thisWeekStart = new Date(today);
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
      thisWeekStart.setDate(today.getDate() - daysToMonday);
      thisWeekStart.setUTCHours(0, 0, 0, 0);

      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
      thisWeekEnd.setUTCHours(23, 59, 59, 999);

      // Last week
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(thisWeekStart.getDate() - 7);

      const lastWeekEnd = new Date(thisWeekEnd);
      lastWeekEnd.setDate(thisWeekEnd.getDate() - 7);

      // Run all queries in parallel for better performance
      const [
        registeredToday,
        registeredYesterday,
        registeredThisWeek,
        registeredLastWeek,
        myTotalRegistrations
      ] = await Promise.all([
        // Registered today
        this.prismaService.customer.count({
          where: {
            createdByPartnerId: partnerId,
            createdAt: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
            }
          }
        }),

        // Registered yesterday
        this.prismaService.customer.count({
          where: {
            createdByPartnerId: partnerId,
            createdAt: {
              gte: yesterday,
              lt: today
            }
          }
        }),

        // Registered this week
        this.prismaService.customer.count({
          where: {
            createdByPartnerId: partnerId,
            createdAt: {
              gte: thisWeekStart,
              lte: thisWeekEnd
            }
          }
        }),

        // Registered last week
        this.prismaService.customer.count({
          where: {
            createdByPartnerId: partnerId,
            createdAt: {
              gte: lastWeekStart,
              lte: lastWeekEnd
            }
          }
        }),

        // Total registrations by this partner
        this.prismaService.customer.count({
          where: {
            createdByPartnerId: partnerId
          }
        })
      ]);

      return {
        registeredToday,
        registeredYesterday,
        registeredThisWeek,
        registeredLastWeek,
        myTotalRegistrations
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting brand ambassador dashboard stats: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(correlationId: string = 'unknown') {
    try {
      this.logger.log(`[${correlationId}] Getting dashboard statistics`);

      // Get today's date range (start and end of today)
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Run all queries in parallel for better performance
      const [
        totalAgents,
        activeAgents,
        totalCustomers,
        registrationsToday,
        pendingMRs
      ] = await Promise.all([
        // Total agents count
        this.prismaService.brandAmbassador.count(),

        // Active agents count
        this.prismaService.brandAmbassador.count({
          where: { isActive: true }
        }),

        // Total customers count
        this.prismaService.customer.count(),

        // Registrations today count
        this.prismaService.customer.count({
          where: {
            createdAt: {
              gte: startOfToday,
              lt: endOfToday
            }
          }
        }),

        // Pending MRs count (customers with missing requirements)
        this.prismaService.customer.count({
          where: { hasMissingRequirements: true }
        })
      ]);

      return {
        totalAgents,
        activeAgents,
        totalCustomers,
        registrationsToday,
        pendingMRs,
        activeAgentRate: totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 100) : 0
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting dashboard statistics: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get Brand Ambassadors for filter dropdown
   */
  async getBrandAmbassadorsForFilter(correlationId: string = 'unknown') {
    try {
      this.logger.log(`[${correlationId}] Getting brand ambassadors for filter`);

      const brandAmbassadors = await this.prismaService.brandAmbassador.findMany({
        where: {
          isActive: true,
        },
        select: {
          displayName: true,
          partnerId: true,
        },
        orderBy: {
          displayName: 'asc',
        },
      });

      // Remove duplicates based on displayName
      const uniqueBrandAmbassadors = brandAmbassadors.reduce((acc, ba) => {
        if (!acc.find(item => item.displayName === ba.displayName)) {
          acc.push(ba);
        }
        return acc;
      }, [] as typeof brandAmbassadors);

      return {
        brandAmbassadors: uniqueBrandAmbassadors.map(ba => ({
          displayName: ba.displayName,
          partnerId: ba.partnerId,
        })),
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting brand ambassadors for filter: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get all customers for admin view with pagination and filtering
   */
  async getAllCustomers(
    page: number = 1,
    pageSize: number = 20,
    fromDate?: string,
    toDate?: string,
    createdBy?: string,
    correlationId: string = 'unknown'
  ) {
    try {
      this.logger.log(`[${correlationId}] Getting all customers, page ${page}, pageSize ${pageSize}`);

      const skip = (page - 1) * pageSize;

      // Build date filter
      const dateFilter: any = {};
      if (fromDate) {
        dateFilter.gte = new Date(fromDate);
      }
      if (toDate) {
        dateFilter.lte = new Date(toDate);
      }

      const whereClause: any = {};

      if (Object.keys(dateFilter).length > 0) {
        whereClause.createdAt = dateFilter;
      }

      // Get brand ambassadors for filtering if createdBy is specified
      const brandAmbassadorFilter: any = {};
      if (createdBy) {
        const brandAmbassadors = await this.prismaService.brandAmbassador.findMany({
          where: {
            displayName: {
              contains: createdBy,
              mode: 'insensitive',
            },
          },
          select: {
            partnerId: true,
          },
        });

        if (brandAmbassadors.length > 0) {
          whereClause.createdByPartnerId = {
            in: brandAmbassadors.map(ba => ba.partnerId),
          };
        } else {
          // If no brand ambassadors found, return empty result
          return {
            data: [],
            pagination: {
              page,
              pageSize,
              totalItems: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          };
        }
      }

      // Get customers with pagination and creator info
      const [customers, totalCount] = await Promise.all([
        this.prismaService.customer.findMany({
          where: whereClause,
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            phoneNumber: true,
            gender: true,
            createdAt: true,
            idType: true,
            idNumber: true,
            hasMissingRequirements: true,
            createdBy: true,
            createdByPartnerId: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: pageSize,
        }),
        this.prismaService.customer.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      // Get brand ambassador info for registered by field
      const userIds = [...new Set(customers.map(c => c.createdBy).filter((id): id is string => id !== null))];
      const brandAmbassadors = await this.prismaService.brandAmbassador.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },
        select: {
          userId: true,
          displayName: true,
        },
      });

      const baMap = new Map(brandAmbassadors.map(ba => [ba.userId, ba.displayName]));

      // Transform data for admin view (unmasked)
      const transformedCustomers = customers.map(customer => ({
        id: customer.id,
        fullName: this.formatFullName(customer.firstName, customer.middleName, customer.lastName),
        phoneNumber: customer.phoneNumber,
        gender: customer.gender?.toLowerCase() || 'unknown',
        createdAt: customer.createdAt.toISOString(),
        registeredBy: customer.createdBy ? (baMap.get(customer.createdBy) ?? 'Unknown') : 'Unknown',
        idType: customer.idType,
        idNumber: customer.idNumber,
        hasMissingRequirements: customer.hasMissingRequirements,
      }));

      return {
        data: transformedCustomers,
        pagination: {
          page,
          pageSize,
          totalItems: totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting all customers: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Search customers by name, ID number, phone number, or email
   * Uses partial matching (LIKE query) for all search fields
   * Name search searches across firstName, middleName, and lastName
   */
  async searchCustomers(
    name?: string,
    idNumber?: string,
    phoneNumber?: string,
    email?: string,
    page: number = 1,
    pageSize: number = 20,
    correlationId: string = 'unknown'
  ) {
    try {
      this.logger.log(`[${correlationId}] Searching customers: name=${name}, idNumber=${idNumber}, phoneNumber=${phoneNumber}, email=${email}`);

      // At least one search parameter must be provided
      if (!name && !idNumber && !phoneNumber && !email) {
        return {
          data: [],
          pagination: {
            page,
            pageSize,
            totalItems: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }

      const skip = (page - 1) * pageSize;

      // Build OR conditions for partial matching
      const orConditions: any[] = [];

      if (name) {
        // Search across firstName, middleName, and lastName
        orConditions.push({
          OR: [
            {
              firstName: {
                contains: name,
                mode: 'insensitive',
              },
            },
            {
              middleName: {
                contains: name,
                mode: 'insensitive',
              },
            },
            {
              lastName: {
                contains: name,
                mode: 'insensitive',
              },
            },
          ],
        });
      }

      if (idNumber) {
        orConditions.push({
          idNumber: {
            contains: idNumber,
            mode: 'insensitive',
          },
        });
      }

      if (phoneNumber) {
        orConditions.push({
          phoneNumber: {
            contains: phoneNumber,
            mode: 'insensitive',
          },
        });
      }

      if (email) {
        orConditions.push({
          email: {
            contains: email,
            mode: 'insensitive',
          },
        });
      }

      const whereClause = {
        OR: orConditions,
      };

      // Get customers with dependant and beneficiary counts
      const [customers, totalCount] = await Promise.all([
        this.prismaService.customer.findMany({
          where: whereClause,
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
            idType: true,
            idNumber: true,
            dependants: {
              select: {
                relationship: true,
              },
            },
            beneficiaries: {
              select: {
                id: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: pageSize,
        }),
        this.prismaService.customer.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      // Transform data for search results
      const searchResults = customers.map(customer => {
        // Count spouses and children
        const numberOfSpouses = customer.dependants.filter(
          d => d.relationship === 'SPOUSE'
        ).length;
        const numberOfChildren = customer.dependants.filter(
          d => d.relationship === 'CHILD'
        ).length;
        const nokAdded = customer.beneficiaries.length > 0;

        return {
          id: customer.id,
          fullName: this.formatFullName(customer.firstName, customer.middleName, customer.lastName),
          idType: customer.idType,
          idNumber: customer.idNumber,
          phoneNumber: customer.phoneNumber,
          email: customer.email ?? undefined,
          numberOfSpouses,
          numberOfChildren,
          nokAdded,
        };
      });

      return {
        data: searchResults,
        pagination: {
          page,
          pageSize,
          totalItems: totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error searching customers: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Export customers to CSV format
   */
  async exportCustomersToCSV(
    fromDate?: string,
    toDate?: string,
    correlationId: string = 'unknown'
  ) {
    try {
      this.logger.log(`[${correlationId}] Exporting customers to CSV`);

      // Build date filter
      const dateFilter: any = {};
      if (fromDate) {
        dateFilter.gte = new Date(fromDate);
      }
      if (toDate) {
        dateFilter.lte = new Date(toDate);
      }

      const whereClause: any = {};

      if (Object.keys(dateFilter).length > 0) {
        whereClause.createdAt = dateFilter;
      }

      // Get all customers for export
      const customers = await this.prismaService.customer.findMany({
        where: whereClause,
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          phoneNumber: true,
          gender: true,
          createdAt: true,
          idType: true,
          idNumber: true,
          hasMissingRequirements: true,
          createdByPartnerId: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Get brand ambassador info
      const partnerIds = [...new Set(customers.map(c => c.createdByPartnerId))];
      const brandAmbassadors = await this.prismaService.brandAmbassador.findMany({
        where: {
          partnerId: {
            in: partnerIds,
          },
        },
        select: {
          partnerId: true,
          displayName: true,
        },
      });

      const baMap = new Map(brandAmbassadors.map(ba => [ba.partnerId, ba.displayName]));

      // Generate CSV content
      const csvHeaders = [
        'Customer ID',
        'Full Name',
        'Phone Number',
        'Gender',
        'Registration Date',
        'Registered By',
        'ID Type',
        'ID Number',
        'Has Missing Requirements',
      ];

      const csvRows = customers.map(customer => [
        customer.id,
        this.formatFullName(customer.firstName, customer.middleName, customer.lastName),
        customer.phoneNumber,
        customer.gender?.toLowerCase() || 'unknown',
        customer.createdAt.toISOString(),
        baMap.get(customer.createdByPartnerId) || 'Unknown',
        customer.idType,
        customer.idNumber,
        customer.hasMissingRequirements ? 'Yes' : 'No',
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return {
        filename: `customers_export_${new Date().toISOString().split('T')[0]}.csv`,
        content: csvContent,
        contentType: 'text/csv',
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error exporting customers to CSV: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Helper method to mask phone numbers
   */
  private maskPhoneNumber(phoneNumber: string | null): string {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return 'N/A';
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (cleanPhone.length < 7) {
      return cleanPhone.substring(0, 4) + '***';
    }

    const start = cleanPhone.substring(0, 4);
    const end = cleanPhone.substring(cleanPhone.length - 3);
    const maskedMiddle = '*'.repeat(Math.max(3, cleanPhone.length - 7));

    if (phoneNumber.startsWith('+')) {
      return `+${start}${maskedMiddle}${end}`;
    }

    return `${start}${maskedMiddle}${end}`;
  }

  /**
   * Helper method to mask ID numbers
   */
  private maskIdNumber(idNumber: string | null): string {
    if (!idNumber || idNumber.trim() === '') {
      return 'N/A';
    }

    if (idNumber.length < 4) {
      return '*'.repeat(idNumber.length);
    }

    const start = idNumber.substring(0, 2);
    const end = idNumber.substring(idNumber.length - 2);
    const maskedMiddle = '*'.repeat(Math.max(2, idNumber.length - 4));

    return `${start}${maskedMiddle}${end}`;
  }

  /**
   * Get customer details with relations (for detail page)
   * @param customerId - Customer ID
   * @param userId - User ID
   * @param userRoles - User roles array
   * @param correlationId - Correlation ID for tracing
   * @returns Customer details with beneficiaries, dependants, and policies
   */
  async getCustomerDetails(
    customerId: string,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<CustomerDetailResponseDto> {
    this.logger.log(`[${correlationId}] Getting customer details for ${customerId}`);

    try {
      // Check access permission
      const canAccess = await this.canUserAccessCustomer(customerId, userId, userRoles);
      if (!canAccess) {
        throw new NotFoundException('Customer not found or not accessible');
      }

      // Get customer with all relations
      const customer = await this.prismaService.customer.findUnique({
        where: { id: customerId },
        include: {
          beneficiaries: true,
          dependants: true,
          policies: {
            include: {
              package: {
                select: {
                  id: true,
                  name: true,
                },
              },
              packagePlan: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          partnerCustomers: {
            take: 1,
            select: {
              partnerCustomerId: true,
            },
          },
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // Get brand ambassador display name for createdBy if it exists
      let createdByDisplayName: string | undefined;
      if (customer.createdBy) {
        const brandAmbassador = await this.prismaService.brandAmbassador.findUnique({
          where: { userId: customer.createdBy },
          select: { displayName: true },
        });
        createdByDisplayName = brandAmbassador?.displayName;
      }

      const customerEntity = Customer.fromPrismaData(customer);
      const customerDto = CustomerMapper.toPrincipalMemberDto(customerEntity);

      // Map beneficiaries
      const beneficiaries = customer.beneficiaries.map((b) => ({
        id: b.id,
        firstName: b.firstName,
        middleName: b.middleName ?? undefined,
        lastName: b.lastName,
        dateOfBirth: b.dateOfBirth ? b.dateOfBirth.toISOString().split('T')[0] : undefined,
        phoneNumber: b.phoneNumber ?? undefined,
        gender: b.gender ? SharedMapperUtils.mapGenderToDto(b.gender) : undefined,
        idType: SharedMapperUtils.mapIdTypeToDto(b.idType),
        idNumber: b.idNumber ?? undefined,
      }));

      // Map dependants
      const dependants = customer.dependants.map((d) => ({
        id: d.id,
        firstName: d.firstName,
        middleName: d.middleName ?? undefined,
        lastName: d.lastName,
        dateOfBirth: d.dateOfBirth ? d.dateOfBirth.toISOString().split('T')[0] : undefined,
        phoneNumber: d.phoneNumber ?? undefined,
        gender: d.gender ? SharedMapperUtils.mapGenderToDto(d.gender) : undefined,
        idType: d.idType ? SharedMapperUtils.mapIdTypeToDto(d.idType) : undefined,
        idNumber: d.idNumber ?? undefined,
        relationship: d.relationship,
        verificationRequired: d.verificationRequired ?? false,
      }));

      // Map policies
      const policies = customer.policies.map((p) => ({
        id: p.id,
        policyNumber: p.policyNumber,
        packageName: p.package.name,
        planName: p.packagePlan?.name,
        status: p.status,
      }));

      const data: CustomerDetailDataDto = {
        customer: {
          ...customerDto,
          id: customer.id,
          createdAt: customer.createdAt.toISOString(),
          createdBy: customer.createdBy ?? undefined,
          createdByDisplayName: createdByDisplayName,
        },
        beneficiaries,
        dependants,
        policies,
      };

      return {
        status: 200,
        correlationId,
        message: 'Customer details retrieved successfully',
        data,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting customer details: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get customer policies for filter dropdown
   * @param customerId - Customer ID
   * @param userId - User ID
   * @param userRoles - User roles array
   * @param correlationId - Correlation ID for tracing
   * @returns List of policies formatted for dropdown
   */
  async getCustomerPolicies(
    customerId: string,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<CustomerPoliciesResponseDto> {
    this.logger.log(`[${correlationId}] Getting customer policies for ${customerId}`);

    try {
      // Check access permission
      const canAccess = await this.canUserAccessCustomer(customerId, userId, userRoles);
      if (!canAccess) {
        throw new NotFoundException('Customer not found or not accessible');
      }

      // Get customer policies
      const policies = await this.prismaService.policy.findMany({
        where: { customerId },
        include: {
          package: {
            select: {
              name: true,
            },
          },
          packagePlan: {
            select: {
              name: true,
            },
          },
        },
      });

      const policyOptions: PolicyOptionDto[] = policies.map((p) => ({
        id: p.id,
        displayText: p.packagePlan
          ? `${p.package.name} - ${p.packagePlan.name}`
          : p.package.name,
        packageName: p.package.name,
        planName: p.packagePlan?.name,
      }));

      return {
        status: 200,
        correlationId,
        message: 'Customer policies retrieved successfully',
        data: policyOptions,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting customer policies: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get customer payments with filters
   * @param customerId - Customer ID
   * @param userId - User ID
   * @param userRoles - User roles array
   * @param policyId - Optional policy ID filter
   * @param fromDate - Optional from date filter
   * @param toDate - Optional to date filter
   * @param correlationId - Correlation ID for tracing
   * @returns Filtered payments ordered by actualPaymentDate DESC
   */
  async getCustomerPayments(
    customerId: string,
    userId: string,
    userRoles: string[],
    correlationId: string,
    policyId?: string,
    fromDate?: string,
    toDate?: string
  ): Promise<CustomerPaymentsResponseDto> {
    this.logger.log(`[${correlationId}] Getting customer payments for ${customerId}`);

    try {
      // Check access permission
      const canAccess = await this.canUserAccessCustomer(customerId, userId, userRoles);
      if (!canAccess) {
        throw new NotFoundException('Customer not found or not accessible');
      }

      // Build where clause
      const where: any = {
        policy: {
          customerId,
        },
      };

      if (policyId) {
        where.policyId = policyId;
      }

      if (fromDate || toDate) {
        where.expectedPaymentDate = {};
        if (fromDate) {
          where.expectedPaymentDate.gte = new Date(fromDate);
        }
        if (toDate) {
          where.expectedPaymentDate.lte = new Date(toDate);
        }
      }

      // Get payments ordered by actualPaymentDate DESC (nulls last)
      // Prisma handles nulls by putting them last in desc order
      const payments = await this.prismaService.policyPayment.findMany({
        where,
        orderBy: {
          actualPaymentDate: 'desc',
        },
      });

      const paymentDtos: PaymentDto[] = payments.map((p) => ({
        id: p.id,
        paymentType: p.paymentType,
        transactionReference: p.transactionReference,
        accountNumber: p.accountNumber ?? undefined,
        expectedPaymentDate: p.expectedPaymentDate.toISOString(),
        actualPaymentDate: p.actualPaymentDate?.toISOString(),
        amount: Number(p.amount),
      }));

      return {
        status: 200,
        correlationId,
        message: 'Payments retrieved successfully',
        data: paymentDtos,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting customer payments: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Update customer
   * @param customerId - Customer ID
   * @param updateData - Update data
   * @param userId - User ID
   * @param userRoles - User roles array
   * @param correlationId - Correlation ID for tracing
   * @returns Updated customer
   */
  async updateCustomer(
    customerId: string,
    updateData: UpdateCustomerDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<PrincipalMemberDto> {
    this.logger.log(`[${correlationId}] Updating customer ${customerId}`);

    try {
      // Check access permission
      const canAccess = await this.canUserAccessCustomer(customerId, userId, userRoles);
      if (!canAccess) {
        throw new NotFoundException('Customer not found or not accessible');
      }

      // Build update data
      const updatePayload: any = {};
      if (updateData.firstName !== undefined) updatePayload.firstName = updateData.firstName;
      if (updateData.middleName !== undefined) updatePayload.middleName = updateData.middleName;
      if (updateData.lastName !== undefined) updatePayload.lastName = updateData.lastName;
      if (updateData.dateOfBirth !== undefined) updatePayload.dateOfBirth = new Date(updateData.dateOfBirth);
      if (updateData.email !== undefined) updatePayload.email = updateData.email;
      if (updateData.phoneNumber !== undefined) updatePayload.phoneNumber = updateData.phoneNumber;
      if (updateData.gender !== undefined) updatePayload.gender = SharedMapperUtils.mapGenderFromDto(updateData.gender);
      if (updateData.idType !== undefined) {
        updatePayload.idType = SharedMapperUtils.mapIdTypeFromDto(updateData.idType);
      }
      if (updateData.idNumber !== undefined) {
        const trimmedIdNumber = updateData.idNumber?.trim();
        updatePayload.idNumber = trimmedIdNumber && trimmedIdNumber.length > 0 ? trimmedIdNumber : null;
      }
      updatePayload.updatedBy = userId;

      // Update customer
      const updated = await this.prismaService.customer.update({
        where: { id: customerId },
        data: updatePayload,
      });

      const customerEntity = Customer.fromPrismaData(updated);
      return CustomerMapper.toPrincipalMemberDto(customerEntity);
    } catch (error) {
      this.logger.error(`[${correlationId}] Error updating customer: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Update dependant
   * @param dependantId - Dependant ID
   * @param updateData - Update data
   * @param userId - User ID
   * @param userRoles - User roles array
   * @param correlationId - Correlation ID for tracing
   * @returns Updated dependant
   */
  async updateDependant(
    dependantId: string,
    updateData: UpdateDependantDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<any> {
    this.logger.log(`[${correlationId}] Updating dependant ${dependantId}`);

    try {
      // Get dependant to check customer access and relationship
      const dependant = await this.prismaService.dependant.findUnique({
        where: { id: dependantId },
        select: { customerId: true, relationship: true },
      });

      if (!dependant) {
        throw new NotFoundException('Dependant not found');
      }

      // Check access permission via customer
      const canAccess = await this.canUserAccessCustomer(dependant.customerId, userId, userRoles);
      if (!canAccess) {
        throw new NotFoundException('Dependant not found or not accessible');
      }

      // Build update data
      const updatePayload: any = {};
      if (updateData.firstName !== undefined) updatePayload.firstName = updateData.firstName;
      if (updateData.middleName !== undefined) updatePayload.middleName = updateData.middleName;
      if (updateData.lastName !== undefined) updatePayload.lastName = updateData.lastName;
      if (updateData.dateOfBirth !== undefined) {
        const dateOfBirth = updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : null;
        updatePayload.dateOfBirth = dateOfBirth;
        // Update verificationRequired for children if dateOfBirth is being updated
        if (dependant.relationship === 'CHILD') {
          updatePayload.verificationRequired = this.calculateChildVerificationRequired(dateOfBirth);
        }
      }
      if (updateData.email !== undefined) updatePayload.email = updateData.email;
      if (updateData.phoneNumber !== undefined) updatePayload.phoneNumber = updateData.phoneNumber;
      if (updateData.gender !== undefined) updatePayload.gender = SharedMapperUtils.mapGenderFromDto(updateData.gender);
      if (updateData.idType !== undefined) {
        updatePayload.idType = SharedMapperUtils.mapIdTypeFromDto(updateData.idType);
      }
      if (updateData.idNumber !== undefined) {
        const trimmedIdNumber = updateData.idNumber?.trim();
        updatePayload.idNumber = trimmedIdNumber && trimmedIdNumber.length > 0 ? trimmedIdNumber : null;
      }

      // Update dependant
      const updated = await this.prismaService.dependant.update({
        where: { id: dependantId },
        data: updatePayload,
      });

      return {
        id: updated.id,
        firstName: updated.firstName,
        middleName: updated.middleName ?? undefined,
        lastName: updated.lastName,
        dateOfBirth: updated.dateOfBirth ? updated.dateOfBirth.toISOString().split('T')[0] : undefined,
        phoneNumber: updated.phoneNumber ?? undefined,
        idType: updated.idType ?? undefined,
        idNumber: updated.idNumber ?? undefined,
        relationship: updated.relationship,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error updating dependant: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Update beneficiary
   * @param customerId - Customer ID
   * @param beneficiaryId - Beneficiary ID
   * @param updateData - Update data
   * @param userId - User ID
   * @param userRoles - User roles array
   * @param correlationId - Correlation ID for tracing
   * @returns Updated beneficiary
   */
  async updateBeneficiary(
    customerId: string,
    beneficiaryId: string,
    updateData: UpdateBeneficiaryDto,
    userId: string,
    userRoles: string[],
    correlationId: string
  ): Promise<any> {
    this.logger.log(`[${correlationId}] Updating beneficiary ${beneficiaryId} for customer ${customerId}`);

    try {
      // Check access permission
      const canAccess = await this.canUserAccessCustomer(customerId, userId, userRoles);
      if (!canAccess) {
        throw new NotFoundException('Customer not found or not accessible');
      }

      // Verify beneficiary belongs to customer
      const beneficiary = await this.prismaService.beneficiary.findFirst({
        where: {
          id: beneficiaryId,
          customerId: customerId,
        },
      });

      if (!beneficiary) {
        throw new NotFoundException('Beneficiary not found');
      }

      // Build update data
      const updatePayload: any = {};
      if (updateData.firstName !== undefined) updatePayload.firstName = updateData.firstName;
      if (updateData.middleName !== undefined) updatePayload.middleName = updateData.middleName;
      if (updateData.lastName !== undefined) updatePayload.lastName = updateData.lastName;
      if (updateData.dateOfBirth !== undefined) updatePayload.dateOfBirth = new Date(updateData.dateOfBirth);
      if (updateData.email !== undefined) updatePayload.email = updateData.email;
      if (updateData.phoneNumber !== undefined) updatePayload.phoneNumber = updateData.phoneNumber;
      if (updateData.gender !== undefined) updatePayload.gender = SharedMapperUtils.mapGenderFromDto(updateData.gender);
      if (updateData.idType !== undefined) {
        updatePayload.idType = SharedMapperUtils.mapIdTypeFromDto(updateData.idType);
      }
      if (updateData.idNumber !== undefined) {
        const trimmedIdNumber = updateData.idNumber?.trim();
        updatePayload.idNumber = trimmedIdNumber && trimmedIdNumber.length > 0 ? trimmedIdNumber : null;
      }
      if (updateData.relationship !== undefined) updatePayload.relationship = updateData.relationship;
      if (updateData.relationshipDescription !== undefined) updatePayload.relationshipDescription = updateData.relationshipDescription;
      if (updateData.percentage !== undefined) updatePayload.percentage = updateData.percentage;

      // Update beneficiary
      const updated = await this.prismaService.beneficiary.update({
        where: { id: beneficiaryId },
        data: updatePayload,
      });

      return {
        id: updated.id,
        firstName: updated.firstName,
        middleName: updated.middleName ?? undefined,
        lastName: updated.lastName,
        dateOfBirth: updated.dateOfBirth ? updated.dateOfBirth.toISOString().split('T')[0] : undefined,
        phoneNumber: updated.phoneNumber ?? undefined,
        idType: updated.idType,
        idNumber: updated.idNumber,
        relationship: updated.relationship,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error updating beneficiary: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Helper method to format full name
   */
  private formatFullName(
    firstName: string | null,
    middleName?: string | null,
    lastName?: string | null
  ): string {
    const parts = [firstName, middleName, lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'N/A';
  }

  /**
   * Check if user can access/edit customer
   * @param customerId - Customer ID
   * @param userId - User ID
   * @param userRoles - User roles array
   * @returns true if user can access, false otherwise
   */
  private async canUserAccessCustomer(
    customerId: string,
    userId: string,
    userRoles: string[]
  ): Promise<boolean> {
    // Admins can access any customer
    if (userRoles.includes('registration_admin')) {
      return true;
    }

    // Agents can only access customers they registered
    if (userRoles.includes('brand_ambassador')) {
      const registration = await this.prismaService.agentRegistration.findFirst({
        where: {
          customerId: customerId,
          ba: {
            userId: userId,
          },
        },
      });
      return !!registration;
    }

    return false;
  }

}
