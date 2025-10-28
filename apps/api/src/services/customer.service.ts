import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';
import { PrismaService } from '../prisma/prisma.service';
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
        const childrenData = createRequest.children.map(child => ({
          customerId: createdCustomer.id,
          firstName: child.firstName,
          middleName: child.middleName || null,
          lastName: child.lastName,
          dateOfBirth: child.dateOfBirth ? new Date(child.dateOfBirth) : null,
          gender: child.gender.toUpperCase() as any,
          idType: child.idType ? SharedMapperUtils.mapIdTypeFromDto(child.idType) as any : null,
          idNumber: child.idNumber || null,
          relationship: 'CHILD' as const,
          createdByPartnerId: partnerId,
        }));

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
        const spousesData = createRequest.spouses.map(spouse => ({
          customerId: createdCustomer.id,
          firstName: spouse.firstName,
          middleName: spouse.middleName || null,
          lastName: spouse.lastName,
          dateOfBirth: spouse.dateOfBirth ? new Date(spouse.dateOfBirth) : null,
          gender: spouse.gender.toUpperCase() as any,
          email: spouse.email || null,
          phoneNumber: spouse.phoneNumber || null,
          idType: SharedMapperUtils.mapIdTypeFromDto(spouse.idType) as any,
          idNumber: spouse.idNumber,
          relationship: 'SPOUSE' as const,
          createdByPartnerId: partnerId,
        }));

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
        const beneficiariesData = createRequest.beneficiaries.map(beneficiary => ({
          customerId: createdCustomer.id,
          firstName: beneficiary.firstName,
          middleName: beneficiary.middleName || null,
          lastName: beneficiary.lastName,
          dateOfBirth: new Date(beneficiary.dateOfBirth),
          gender: beneficiary.gender.toUpperCase() as any,
          idType: SharedMapperUtils.mapIdTypeFromDto(beneficiary.idType) as any,
          idNumber: beneficiary.idNumber,
          relationship: beneficiary.relationship,
          percentage: beneficiary.percentage,
          createdByPartnerId: partnerId,
        }));

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
      const result = await this.prismaService.$transaction(async (tx) => {
        const addedDependants: any[] = [];
        let childrenAdded = 0;
        let spousesAdded = 0;

        // Add children if provided
        if (addRequest.children && addRequest.children.length > 0) {
        const childrenData = addRequest.children.map(child => ({
          customerId: customerId,
          firstName: child.firstName,
          middleName: child.middleName || null,
          lastName: child.lastName,
          dateOfBirth: child.dateOfBirth ? new Date(child.dateOfBirth) : null,
          gender: child.gender.toUpperCase() as any,
          idType: child.idType ? SharedMapperUtils.mapIdTypeFromDto(child.idType) as any : null,
          idNumber: child.idNumber || null,
          relationship: 'CHILD' as const,
          createdByPartnerId: partnerId,
        }));

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
        const spousesData = addRequest.spouses.map(spouse => ({
          customerId: customerId,
          firstName: spouse.firstName,
          middleName: spouse.middleName || null,
          lastName: spouse.lastName,
          dateOfBirth: spouse.dateOfBirth ? new Date(spouse.dateOfBirth) : null,
          gender: spouse.gender.toUpperCase() as any,
          email: spouse.email || null,
          phoneNumber: spouse.phoneNumber || null,
          idType: SharedMapperUtils.mapIdTypeFromDto(spouse.idType) as any,
          idNumber: spouse.idNumber,
          relationship: 'SPOUSE' as const,
          createdByPartnerId: partnerId,
        }));

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
            idType: SharedMapperUtils.mapIdTypeFromDto(spouse.idType),
            idNumber: spouse.idNumber,
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
      const result = await this.prismaService.$transaction(async (tx) => {
        const addedBeneficiaries: any[] = [];
        let beneficiariesAdded = 0;

        const beneficiariesData = addRequest.beneficiaries.map(beneficiary => ({
          customerId: customerId,
          firstName: beneficiary.firstName,
          middleName: beneficiary.middleName || null,
          lastName: beneficiary.lastName,
          dateOfBirth: beneficiary.dateOfBirth ? new Date(beneficiary.dateOfBirth) : null,
          gender: beneficiary.gender.toUpperCase() as any,
          email: beneficiary.email || null,
          phoneNumber: beneficiary.phoneNumber || null,
          idType: SharedMapperUtils.mapIdTypeFromDto(beneficiary.idType) as any,
          idNumber: beneficiary.idNumber,
          relationship: beneficiary.relationship,
          relationshipDescription: beneficiary.relationshipDescription || null,
          percentage: beneficiary.percentage,
          createdByPartnerId: partnerId,
        }));

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
        addedBeneficiaries.push(...beneficiariesWithIds.map((beneficiary: any) => ({
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
        })));

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
   */
  async getBrandAmbassadorRegistrations(
    partnerId: number,
    page: number = 1,
    pageSize: number = 20,
    fromDate?: string,
    toDate?: string,
    correlationId: string = 'unknown'
  ) {
    try {
      this.logger.log(`[${correlationId}] Getting brand ambassador registrations for partner ${partnerId}, page ${page}, pageSize ${pageSize}`);

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
        createdByPartnerId: partnerId,
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

      // Transform data for brand ambassador view (masked phone and ID)
      const transformedCustomers = customers.map(customer => ({
        id: customer.id,
        firstName: customer.firstName,
        phoneNumber: this.maskPhoneNumber(customer.phoneNumber),
        gender: customer.gender?.toLowerCase() || 'unknown',
        createdAt: customer.createdAt.toISOString(),
        idType: customer.idType,
        idNumber: this.maskIdNumber(customer.idNumber),
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
      thisWeekStart.setHours(0, 0, 0, 0);
      
      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
      thisWeekEnd.setHours(23, 59, 59, 999);
      
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
      let brandAmbassadorFilter: any = {};
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

      // Transform data for admin view (unmasked)
      const transformedCustomers = customers.map(customer => ({
        id: customer.id,
        fullName: this.formatFullName(customer.firstName, customer.middleName, customer.lastName),
        phoneNumber: customer.phoneNumber,
        gender: customer.gender?.toLowerCase() || 'unknown',
        createdAt: customer.createdAt.toISOString(),
        registeredBy: baMap.get(customer.createdByPartnerId) || 'Unknown',
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

}
