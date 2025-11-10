import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductManagementService } from '../../services/product-management.service';
import { SchemeContactService } from '../../services/scheme-contact.service';
import {
  PackagesResponseDto,
  SchemesResponseDto,
  PlansResponseDto,
  TagsResponseDto,
  CreateTagRequestDto,
  CreateTagResponseDto,
  SearchTagsQueryDto,
} from '../../dto/product-management/product-management.dto';
import {
  PackageDetailResponseDto,
  PackageSchemesResponseDto,
  UpdatePackageRequestDto,
} from '../../dto/packages/package.dto';
import {
  SchemeDetailResponseDto,
  SchemeCustomersResponseDto,
  UpdateSchemeRequestDto,
} from '../../dto/schemes/scheme.dto';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { UserId } from '../../decorators/user.decorator';
import { CreatePackageRequestDto } from '../../dto/packages/package.dto';
import { CreateSchemeRequestDto } from '../../dto/schemes/scheme.dto';
import {
  CreateSchemeContactDto,
  UpdateSchemeContactDto,
  SchemeContactResponseDto,
  SchemeContactsListResponseDto,
} from '../../dto/scheme-contacts/scheme-contact.dto';

/**
 * Internal Product Management Controller
 *
 * Handles HTTP requests for product management operations.
 * Provides endpoints for packages, schemes, plans, and tags.
 *
 * Features:
 * - Package retrieval
 * - Scheme retrieval for packages
 * - Plan retrieval for packages
 * - Tag management (search, create, retrieve by scheme)
 * - Swagger API documentation
 * - Correlation ID tracking
 */
@ApiTags('Internal - Product Management')
@ApiBearerAuth()
@Controller('internal/product-management')
export class ProductManagementController {
  constructor(
    private readonly productManagementService: ProductManagementService,
    private readonly schemeContactService: SchemeContactService
  ) {}

  /**
   * Get all active packages
   */
  @Get('packages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all active packages',
    description: 'Retrieve a list of all active packages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Packages retrieved successfully',
    type: PackagesResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPackages(@CorrelationId() correlationId: string): Promise<PackagesResponseDto> {
    const packages = await this.productManagementService.getPackages(correlationId);

    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Packages retrieved successfully',
      data: packages,
    };
  }

  /**
   * Create a new package
   */
  @Post('packages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new package',
    description: 'Create a new package for an underwriter.',
  })
  @ApiResponse({
    status: 201,
    description: 'Package created successfully',
    type: PackageDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createPackage(
    @Body() createRequest: CreatePackageRequestDto,
    @UserId() userId: string,
    @CorrelationId() correlationId: string
  ): Promise<PackageDetailResponseDto> {
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    const pkg = await this.productManagementService.createPackage(
      createRequest,
      userId,
      correlationId
    );

    return {
      status: HttpStatus.CREATED,
      correlationId,
      message: 'Package created successfully',
      data: pkg,
    };
  }

  /**
   * Get active schemes for a package
   */
  @Get('packages/:packageId/schemes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get schemes for a package',
    description: 'Retrieve a list of active schemes associated with a specific package.',
  })
  @ApiParam({
    name: 'packageId',
    description: 'Package ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Schemes retrieved successfully',
    type: SchemesResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Package not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPackageSchemes(
    @Param('packageId', ParseIntPipe) packageId: number,
    @CorrelationId() correlationId: string
  ): Promise<SchemesResponseDto> {
    const schemes = await this.productManagementService.getPackageSchemes(packageId, correlationId);

    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Schemes retrieved successfully',
      data: schemes,
    };
  }

  /**
   * Get active plans for a package
   */
  @Get('packages/:packageId/plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get plans for a package',
    description: 'Retrieve a list of active plans associated with a specific package.',
  })
  @ApiParam({
    name: 'packageId',
    description: 'Package ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Plans retrieved successfully',
    type: PlansResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Package not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPackagePlans(
    @Param('packageId', ParseIntPipe) packageId: number,
    @CorrelationId() correlationId: string
  ): Promise<PlansResponseDto> {
    const plans = await this.productManagementService.getPackagePlans(packageId, correlationId);

    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Plans retrieved successfully',
      data: plans,
    };
  }

  /**
   * Get tags for a scheme
   */
  @Get('schemes/:schemeId/tags')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get tags for a scheme',
    description: 'Retrieve a list of tags associated with a specific scheme.',
  })
  @ApiParam({
    name: 'schemeId',
    description: 'Scheme ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'search',
    description: 'Optional search query (minimum 3 characters)',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: TagsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Scheme not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getSchemeTags(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Query('search') search?: string,
    @CorrelationId() correlationId?: string
  ): Promise<TagsResponseDto> {
    const tags = await this.productManagementService.getSchemeTags(schemeId, correlationId || 'unknown');

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Tags retrieved successfully',
      data: tags,
    };
  }

  /**
   * Search tags (for autocomplete)
   */
  @Get('tags')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search tags',
    description: 'Search tags by name for autocomplete functionality. Requires at least 3 characters.',
  })
  @ApiQuery({
    name: 'search',
    description: 'Search query (minimum 3 characters)',
    required: true,
    type: String,
    example: 'corp',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: TagsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - search query too short',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async searchTags(
    @Query('search') search: string,
    @Query('limit') limit?: number,
    @CorrelationId() correlationId?: string
  ): Promise<TagsResponseDto> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 10;
    const tags = await this.productManagementService.searchTags(search, limitNum, correlationId || 'unknown');

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Tags retrieved successfully',
      data: tags,
    };
  }

  /**
   * Create a new tag
   */
  @Post('tags')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new tag',
    description: 'Create a new tag. If a tag with the same name (case-insensitive) exists, returns the existing tag.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tag created successfully',
    type: CreateTagResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createTag(
    @Body() createRequest: CreateTagRequestDto,
    @CorrelationId() correlationId?: string
  ): Promise<CreateTagResponseDto> {
    const tag = await this.productManagementService.createTag(createRequest.name, correlationId || 'unknown');

    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId || 'unknown',
      message: 'Tag created successfully',
      data: tag,
    };
  }

  /**
   * Get package by ID
   */
  @Get('packages/:packageId/details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get package details',
    description: 'Retrieve detailed information about a specific package including underwriter info.',
  })
  @ApiParam({
    name: 'packageId',
    description: 'Package ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Package retrieved successfully',
    type: PackageDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Package not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPackageById(
    @Param('packageId', ParseIntPipe) packageId: number,
    @CorrelationId() correlationId?: string
  ): Promise<PackageDetailResponseDto> {
    const pkg = await this.productManagementService.getPackageById(
      packageId,
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Package retrieved successfully',
      data: pkg,
    };
  }

  /**
   * Update a package
   */
  @Put('packages/:packageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a package',
    description: 'Update an existing package. Only provided fields will be updated.',
  })
  @ApiParam({
    name: 'packageId',
    description: 'Package ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Package updated successfully',
    type: PackageDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Package not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updatePackage(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() updateRequest: UpdatePackageRequestDto,
    @CorrelationId() correlationId?: string
  ): Promise<PackageDetailResponseDto> {
    const pkg = await this.productManagementService.updatePackage(
      packageId,
      {
        name: updateRequest.name,
        description: updateRequest.description,
        underwriterId: updateRequest.underwriterId,
        isActive: updateRequest.isActive,
        logoPath: updateRequest.logoPath,
      },
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Package updated successfully',
      data: pkg,
    };
  }

  /**
   * Get schemes for a package with customer counts
   */
  @Get('packages/:packageId/schemes-with-counts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get schemes for a package with customer counts',
    description: 'Retrieve all schemes for a specific package with customer counts.',
  })
  @ApiParam({
    name: 'packageId',
    description: 'Package ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Schemes retrieved successfully',
    type: PackageSchemesResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Package not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPackageSchemesWithCounts(
    @Param('packageId', ParseIntPipe) packageId: number,
    @CorrelationId() correlationId?: string
  ): Promise<PackageSchemesResponseDto> {
    const schemes = await this.productManagementService.getPackageSchemesWithCounts(
      packageId,
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Schemes retrieved successfully',
      data: schemes,
    };
  }

  /**
   * Create a new scheme
   */
  @Post('schemes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new scheme',
    description: 'Create a new scheme, optionally linked to a package.',
  })
  @ApiResponse({
    status: 201,
    description: 'Scheme created successfully',
    type: SchemeDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createScheme(
    @Body() createRequest: CreateSchemeRequestDto,
    @UserId() userId: string,
    @CorrelationId() correlationId: string
  ): Promise<SchemeDetailResponseDto> {
    const scheme = await this.productManagementService.createScheme(
      createRequest,
      userId,
      correlationId
    );

    return {
      status: HttpStatus.CREATED,
      correlationId,
      message: 'Scheme created successfully',
      data: scheme,
    };
  }

  /**
   * Get scheme by ID
   */
  @Get('schemes/:schemeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get scheme details',
    description: 'Retrieve detailed information about a specific scheme.',
  })
  @ApiParam({
    name: 'schemeId',
    description: 'Scheme ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Scheme retrieved successfully',
    type: SchemeDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Scheme not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getSchemeById(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @CorrelationId() correlationId?: string
  ): Promise<SchemeDetailResponseDto> {
    const scheme = await this.productManagementService.getSchemeById(
      schemeId,
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Scheme retrieved successfully',
      data: scheme,
    };
  }

  /**
   * Update a scheme
   */
  @Put('schemes/:schemeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a scheme',
    description: 'Update an existing scheme. Only provided fields will be updated.',
  })
  @ApiParam({
    name: 'schemeId',
    description: 'Scheme ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Scheme updated successfully',
    type: SchemeDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Scheme not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updateScheme(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Body() updateRequest: UpdateSchemeRequestDto,
    @CorrelationId() correlationId?: string
  ): Promise<SchemeDetailResponseDto> {
    const scheme = await this.productManagementService.updateScheme(
      schemeId,
      {
        schemeName: updateRequest.schemeName,
        description: updateRequest.description,
        isActive: updateRequest.isActive,
      },
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Scheme updated successfully',
      data: scheme,
    };
  }

  /**
   * Get customers for a scheme with pagination
   */
  @Get('schemes/:schemeId/customers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customers for a scheme',
    description: 'Retrieve a paginated list of customers enrolled in a specific scheme.',
  })
  @ApiParam({
    name: 'schemeId',
    description: 'Scheme ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (default: 1)',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    description: 'Items per page (default: 20, max: 100)',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Customers retrieved successfully',
    type: SchemeCustomersResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Scheme not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getSchemeCustomers(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CorrelationId() correlationId?: string
  ): Promise<SchemeCustomersResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    const result = await this.productManagementService.getSchemeCustomers(
      schemeId,
      pageNum,
      pageSizeNum,
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Customers retrieved successfully',
      ...result,
    };
  }

  /**
   * Create a contact for a scheme
   */
  @Post('schemes/:schemeId/contacts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a scheme contact',
    description: 'Create a new contact for a scheme. Maximum 5 contacts per scheme.',
  })
  @ApiParam({
    name: 'schemeId',
    description: 'Scheme ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Contact created successfully',
    type: SchemeContactResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Maximum 5 contacts per scheme',
  })
  @ApiResponse({
    status: 404,
    description: 'Scheme not found',
  })
  async createSchemeContact(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Body() createDto: CreateSchemeContactDto,
    @UserId() userId: string,
    @CorrelationId() correlationId?: string
  ): Promise<SchemeContactResponseDto> {
    const contact = await this.schemeContactService.createContact(
      { ...createDto, schemeId },
      userId,
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId || 'unknown',
      message: 'Contact created successfully',
      data: contact,
    };
  }

  /**
   * Get all contacts for a scheme
   */
  @Get('schemes/:schemeId/contacts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get scheme contacts',
    description: 'Retrieve all contacts for a specific scheme.',
  })
  @ApiParam({
    name: 'schemeId',
    description: 'Scheme ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Contacts retrieved successfully',
    type: SchemeContactsListResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Scheme not found',
  })
  async getSchemeContacts(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @CorrelationId() correlationId?: string
  ): Promise<SchemeContactsListResponseDto> {
    const contacts = await this.schemeContactService.getContactsByScheme(
      schemeId,
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Contacts retrieved successfully',
      data: contacts,
    };
  }

  /**
   * Update a scheme contact
   */
  @Put('schemes/:schemeId/contacts/:contactId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a scheme contact',
    description: 'Update an existing scheme contact.',
  })
  @ApiParam({
    name: 'schemeId',
    description: 'Scheme ID',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'contactId',
    description: 'Contact ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Contact updated successfully',
    type: SchemeContactResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contact not found',
  })
  async updateSchemeContact(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() updateDto: UpdateSchemeContactDto,
    @UserId() userId: string,
    @CorrelationId() correlationId?: string
  ): Promise<SchemeContactResponseDto> {
    const contact = await this.schemeContactService.updateContact(
      contactId,
      updateDto,
      userId,
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Contact updated successfully',
      data: contact,
    };
  }

  /**
   * Delete a scheme contact
   */
  @Delete('schemes/:schemeId/contacts/:contactId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a scheme contact',
    description: 'Delete a scheme contact (hard delete).',
  })
  @ApiParam({
    name: 'schemeId',
    description: 'Scheme ID',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'contactId',
    description: 'Contact ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Contact deleted successfully',
    type: SchemeContactResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contact not found',
  })
  async deleteSchemeContact(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @CorrelationId() correlationId?: string
  ): Promise<SchemeContactResponseDto> {
    const contact = await this.schemeContactService.deleteContact(
      contactId,
      correlationId || 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId || 'unknown',
      message: 'Contact deleted successfully',
      data: contact,
    };
  }
}

