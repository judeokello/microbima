import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductManagementService } from '../../services/product-management.service';
import { PackagePricingService } from '../../services/package-pricing/package-pricing.service';
import { SchemeContactService } from '../../services/scheme-contact.service';
import {
  PackagesResponseDto,
  SchemesResponseDto,
  PlansResponseDto,
  TagsResponseDto,
  CreateTagRequestDto,
  CreateTagResponseDto,
  CreatePackagePlanRequestDto,
  UpdatePackagePlanRequestDto,
  PackagePlanDetailResponseDto,
} from '../../dto/product-management/product-management.dto';
import {
  PackageDetailResponseDto,
  PackageSchemesResponseDto,
  GlobalSchemesListResponseDto,
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
  PackageSchemeDetailResponseDto,
  UpdatePackageSchemeRequestDto,
} from '../../dto/schemes/package-scheme.dto';
import {
  CreateSchemeContactDto,
  UpdateSchemeContactDto,
  SchemeContactResponseDto,
  SchemeContactsListResponseDto,
} from '../../dto/scheme-contacts/scheme-contact.dto';
import { PostpaidSchemePaymentService, parsePostpaidPaymentCsv } from '../../services/postpaid-scheme-payment.service';
import {
  PostpaidSchemePaymentListResponseDto,
  CreatePostpaidSchemePaymentResponseDto,
  PostpaidMpesaLookupResponseDto,
} from '../../dto/postpaid-scheme-payments/postpaid-scheme-payment.dto';
import { PaymentType } from '@prisma/client';
import { SetupAdminOnly } from '../../decorators/ba-auth.decorator';
import {
  PutPackagePricingRequestDto,
  CreatePricingCategoryRequestDto,
  SuggestFillRequestDto,
} from '../../dto/packages/package-pricing.dto';

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
    private readonly packagePricingService: PackagePricingService,
    private readonly schemeContactService: SchemeContactService,
    private readonly postpaidSchemePaymentService: PostpaidSchemePaymentService
  ) {}

  /**
   * Get packages (active by default; pass includeInactive=true for pickers)
   */
  @Get('packages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get packages',
    description:
      'Retrieve packages. By default only active packages. Pass includeInactive=true to include inactive (for admin pickers).',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'When true, include inactive packages',
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
  async getPackages(
    @CorrelationId() correlationId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<PackagesResponseDto> {
    const include = includeInactive === 'true' || includeInactive === '1';
    const packages = await this.productManagementService.getPackages(correlationId, include);

    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Packages retrieved successfully',
      data: packages,
    };
  }

  /**
   * Flat scheme list for campaign / audience pickers (includes inactive).
   * Registered before schemes/:schemeId.
   */
  @Get('schemes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List schemes for pickers',
    description: 'All schemes with isActive flag (inactive rows are for display only).',
  })
  @ApiResponse({ status: 200, description: 'Schemes retrieved successfully' })
  async listSchemesForPicker(@CorrelationId() correlationId: string) {
    const schemes = await this.productManagementService.listSchemesForPicker(correlationId);
    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Schemes retrieved successfully',
      data: schemes,
    };
  }

  @Get('schemes/packages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List packages linked to schemes',
    description:
      'Distinct packages linked via package_schemes for the given scheme IDs (includes inactive).',
  })
  @ApiResponse({ status: 200, description: 'Packages retrieved successfully' })
  async listPackagesForSchemes(
    @CorrelationId() correlationId: string,
    @Query('schemeIds') schemeIdsRaw?: string,
  ) {
    const schemeIds = (schemeIdsRaw ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    const packages = await this.productManagementService.listPackagesForSchemes(
      schemeIds,
      correlationId,
    );
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
  @SetupAdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new package',
    description: 'Create a new package for an underwriter. Requires setup_admin.',
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
   * Get plans for a package (active-only by default; admin can include inactive)
   */
  @Get('packages/:packageId/plans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get plans for a package',
    description:
      'Retrieve plans for a package. Defaults to active plans only; pass includeInactive=true for admin.',
  })
  @ApiParam({
    name: 'packageId',
    description: 'Package ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'When true, include inactive plans',
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
    @Query('includeInactive') includeInactive: string | undefined,
    @CorrelationId() correlationId: string
  ): Promise<PlansResponseDto> {
    const plans = await this.productManagementService.getPackagePlans(
      packageId,
      correlationId,
      includeInactive === 'true' || includeInactive === '1'
    );

    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Plans retrieved successfully',
      data: plans,
    };
  }

  @Post('packages/:packageId/plans')
  @SetupAdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a plan for a package (requires setup_admin)' })
  @ApiParam({ name: 'packageId', type: Number })
  @ApiResponse({ status: 201, type: PackagePlanDetailResponseDto })
  async createPackagePlan(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() body: CreatePackagePlanRequestDto,
    @UserId() userId: string,
    @CorrelationId() correlationId: string
  ): Promise<PackagePlanDetailResponseDto> {
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    const plan = await this.productManagementService.createPackagePlan(
      packageId,
      body,
      userId,
      correlationId
    );
    return {
      status: HttpStatus.CREATED,
      correlationId,
      message: 'Plan created successfully',
      data: plan,
    };
  }

  @Put('packages/:packageId/plans/:planId')
  @SetupAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a package plan (requires setup_admin)',
    description: 'Update description and/or active status. Plan name cannot be changed.',
  })
  @ApiParam({ name: 'packageId', type: Number })
  @ApiParam({ name: 'planId', type: Number })
  @ApiResponse({ status: 200, type: PackagePlanDetailResponseDto })
  async updatePackagePlan(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Param('planId', ParseIntPipe) planId: number,
    @Body() body: UpdatePackagePlanRequestDto,
    @UserId() userId: string,
    @CorrelationId() correlationId: string
  ): Promise<PackagePlanDetailResponseDto> {
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    const plan = await this.productManagementService.updatePackagePlan(
      packageId,
      planId,
      body,
      userId,
      correlationId
    );
    return {
      status: HttpStatus.OK,
      correlationId,
      message: 'Plan updated successfully',
      data: plan,
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
    const tags = await this.productManagementService.getSchemeTags(schemeId, correlationId ?? 'unknown');

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
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
    const tags = await this.productManagementService.searchTags(search, limitNum, correlationId ?? 'unknown');

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
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
    const tag = await this.productManagementService.createTag(createRequest.name, correlationId ?? 'unknown');

    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'Tag created successfully',
      data: tag,
    };
  }

  /**
   * Get package pricing by slug (registration / modify / recovery)
   */
  @Get('packages/by-slug/:slug/pricing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get package pricing by slug' })
  async getPackagePricingBySlug(
    @Param('slug') slug: string,
    @CorrelationId() correlationId?: string,
  ) {
    const data = await this.packagePricingService.getPricingBySlug(slug);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Package pricing retrieved successfully',
      data,
    };
  }

  /**
   * Get package pricing grid
   */
  @Get('packages/:packageId/pricing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get package pricing grid' })
  async getPackagePricing(
    @Param('packageId', ParseIntPipe) packageId: number,
    @CorrelationId() correlationId?: string,
  ) {
    const data = await this.packagePricingService.getPricing(packageId);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Package pricing retrieved successfully',
      data,
    };
  }

  /**
   * Replace/upsert package pricing grid
   */
  @Put('packages/:packageId/pricing')
  @SetupAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace/upsert package pricing (requires setup_admin)' })
  async putPackagePricing(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() body: PutPackagePricingRequestDto,
    @UserId() userId: string,
    @CorrelationId() correlationId?: string,
  ) {
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    const data = await this.packagePricingService.putPricing(packageId, body, userId);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Package pricing saved successfully',
      data,
    };
  }

  /**
   * Add a pricing category
   */
  @Post('packages/:packageId/pricing/categories')
  @SetupAdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a pricing category (requires setup_admin)' })
  async createPackagePricingCategory(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() body: CreatePricingCategoryRequestDto,
    @UserId() userId: string,
    @CorrelationId() correlationId?: string,
  ) {
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    const result = await this.packagePricingService.createCategory(packageId, body, userId);
    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'Pricing category created successfully',
      data: result,
    };
  }

  /**
   * Suggest fill for empty pricing cells
   */
  @Post('packages/:packageId/pricing/suggest-fill')
  @SetupAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suggest fill for empty pricing cells (requires setup_admin)' })
  async suggestPackagePricingFill(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Body() body: SuggestFillRequestDto,
    @CorrelationId() correlationId?: string,
  ) {
    const data = await this.packagePricingService.suggestFill(packageId, body);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Suggest fill computed successfully',
      data,
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
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Package retrieved successfully',
      data: pkg,
    };
  }

  /**
   * Update a package
   */
  @Put('packages/:packageId')
  @SetupAdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a package (requires setup_admin)',
    description: 'Update an existing package. Only provided fields will be updated. Activation requires complete pricing.',
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
        slug: updateRequest.slug,
        description: updateRequest.description,
        underwriterId: updateRequest.underwriterId,
        isActive: updateRequest.isActive,
        logoPath: updateRequest.logoPath,
        paymentFrequencies: updateRequest.paymentFrequencies,
      },
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
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
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
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
   * Get all schemes with customer counts (paginated)
   */
  @Get('schemes-with-counts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all schemes with customer counts',
    description:
      'Retrieve a paginated list of all package-scheme assignments with underwriter, package, and customer counts.',
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
    description: 'Schemes retrieved successfully',
    type: GlobalSchemesListResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getAllSchemesWithCounts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CorrelationId() correlationId?: string
  ): Promise<GlobalSchemesListResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    const result = await this.productManagementService.getAllSchemesWithCounts(
      pageNum,
      pageSizeNum,
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Schemes retrieved successfully',
      ...result,
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
  @ApiQuery({
    name: 'packageId',
    description: 'Package ID for package-scheme waiting period context',
    required: false,
    type: Number,
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
    @Query('packageId') packageId?: string,
    @CorrelationId() correlationId?: string
  ): Promise<SchemeDetailResponseDto> {
    const parsedPackageId =
      packageId != null && packageId.trim() !== '' ? parseInt(packageId, 10) : undefined;
    const scheme = await this.productManagementService.getSchemeById(
      schemeId,
      correlationId ?? 'unknown',
      Number.isFinite(parsedPackageId) ? parsedPackageId : undefined,
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Scheme retrieved successfully',
      data: scheme,
    };
  }

  /**
   * Update package-scheme waiting period
   */
  @Patch('packages/:packageId/schemes/:schemeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update package-scheme waiting period',
    description: 'Update generalSchemeWaitingPeriod on the package-schemes junction row.',
  })
  async updatePackageSchemeWaitingPeriod(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Body() body: UpdatePackageSchemeRequestDto,
    @CorrelationId() correlationId?: string,
  ): Promise<PackageSchemeDetailResponseDto> {
    const data = await this.productManagementService.updatePackageSchemeWaitingPeriod(
      packageId,
      schemeId,
      body.generalSchemeWaitingPeriod,
      correlationId ?? 'unknown',
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Package scheme updated successfully',
      data,
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
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
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
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
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
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
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
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
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
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
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
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Contact deleted successfully',
      data: contact,
    };
  }

  /**
   * List postpaid scheme payments (postpaid schemes only)
   */
  @Get('schemes/:schemeId/postpaid-payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List postpaid scheme payments',
    description: 'List payments uploaded for a postpaid scheme. Only available for postpaid schemes.',
  })
  @ApiParam({ name: 'schemeId', description: 'Scheme ID', type: Number })
  @ApiResponse({ status: 200, description: 'List of payments', type: PostpaidSchemePaymentListResponseDto })
  @ApiResponse({ status: 400, description: 'Scheme is not postpaid' })
  @ApiResponse({ status: 404, description: 'Scheme not found' })
  async listPostpaidSchemePayments(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @CorrelationId() correlationId?: string
  ): Promise<PostpaidSchemePaymentListResponseDto> {
    const data = await this.postpaidSchemePaymentService.listByScheme(
      schemeId,
      correlationId ?? 'unknown'
    );
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Postpaid scheme payments retrieved successfully',
      data,
    };
  }

  /**
   * Look up an M-Pesa IPN/statement row for a postpaid MPESA batch transaction reference.
   */
  @Get('schemes/:schemeId/postpaid-payments/mpesa-lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Look up M-Pesa transaction reference for postpaid upload',
    description:
      'Verifies the batch transaction reference exists in mpesa_payment_report_items and is not already mapped. Used by the admin UI on field blur when payment type is MPESA.',
  })
  @ApiParam({ name: 'schemeId', description: 'Scheme ID', type: Number })
  @ApiQuery({ name: 'transactionReference', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Lookup result', type: PostpaidMpesaLookupResponseDto })
  @ApiResponse({ status: 400, description: 'Scheme is not postpaid' })
  @ApiResponse({ status: 404, description: 'Scheme not found' })
  async lookupPostpaidMpesaTransactionReference(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Query('transactionReference') transactionReference: string,
    @CorrelationId() correlationId?: string
  ): Promise<PostpaidMpesaLookupResponseDto> {
    // Ensure scheme exists and is postpaid (same gate as list/create)
    await this.postpaidSchemePaymentService.assertSchemeIsPostpaid(schemeId);
    const data = await this.postpaidSchemePaymentService.lookupMpesaTransactionReference(
      transactionReference ?? '',
      correlationId ?? 'unknown'
    );
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: data.valid
        ? 'M-Pesa transaction reference verified'
        : (data.error ?? 'M-Pesa transaction reference invalid'),
      data,
    };
  }

  /**
   * Validate CSV and amount for postpaid scheme payment (no persist)
   */
  @Post('schemes/:schemeId/postpaid-payments/validate')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Validate postpaid payment CSV',
    description:
      'Validate CSV rows and amount match. For MPESA, also verifies the batch transaction reference against unmapped IPN rows. Does not persist.',
  })
  @ApiParam({ name: 'schemeId', description: 'Scheme ID', type: Number })
  @ApiResponse({ status: 200, description: 'Validation result' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async validatePostpaidSchemePayment(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: { amount?: string; transactionReference?: string; paymentType?: string },
    @CorrelationId() correlationId?: string
  ): Promise<{ valid: boolean; errors?: string[] }> {
    if (!file?.buffer) {
      throw new BadRequestException('CSV file is required');
    }
    const amount = body.amount != null ? Number(body.amount) : NaN;
    if (Number.isNaN(amount) || amount < 0 || amount > 9_999_999.99) {
      throw new BadRequestException('Valid amount (0–9999999.99) is required');
    }
    const csvText = file.buffer.toString('utf-8');
    const csvRows = parsePostpaidPaymentCsv(csvText);
    if (csvRows.length === 0) {
      return { valid: false, errors: ['CSV has no valid data rows'] };
    }
    const paymentTypeRaw = (body.paymentType ?? '').trim().toUpperCase();
    const validTypes: PaymentType[] = ['MPESA', 'SASAPAY', 'BANK_TRANSFER', 'CHEQUE'];
    const paymentType =
      paymentTypeRaw && validTypes.includes(paymentTypeRaw as PaymentType)
        ? (paymentTypeRaw as PaymentType)
        : undefined;
    const result = await this.postpaidSchemePaymentService.validateCsvAndAmount(
      schemeId,
      {
        amount,
        transactionReference: body.transactionReference ?? '',
        paymentType,
      },
      csvRows,
      correlationId ?? 'unknown'
    );
    return result.valid ? { valid: true } : { valid: false, errors: result.errors };
  }

  /**
   * Create postpaid scheme payment (upload CSV, create batch and policy payments, activate if first payment)
   */
  @Post('schemes/:schemeId/postpaid-payments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Create postpaid scheme payment',
    description: 'Upload CSV and create batch payment. Validates amount vs CSV sum and that each ID is in scheme. Activates policies on first payment.',
  })
  @ApiParam({ name: 'schemeId', description: 'Scheme ID', type: Number })
  @ApiResponse({ status: 201, description: 'Payment created', type: CreatePostpaidSchemePaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Scheme not found' })
  async createPostpaidSchemePayment(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      amount?: string;
      paymentType?: string;
      transactionReference?: string;
      transactionDate?: string;
    },
    @UserId() userId: string,
    @CorrelationId() correlationId?: string
  ): Promise<CreatePostpaidSchemePaymentResponseDto> {
    if (!file?.buffer) {
      throw new BadRequestException('CSV file is required');
    }
    const amount = body.amount != null ? Number(body.amount) : NaN;
    if (Number.isNaN(amount) || amount < 0 || amount > 9_999_999.99) {
      throw new BadRequestException('Valid amount (0–9999999.99) is required');
    }
    const paymentType = body.paymentType as PaymentType | undefined;
    const validTypes: PaymentType[] = ['MPESA', 'SASAPAY', 'BANK_TRANSFER', 'CHEQUE'];
    if (!paymentType || !validTypes.includes(paymentType)) {
      throw new BadRequestException('paymentType must be one of: MPESA, SASAPAY, BANK_TRANSFER, CHEQUE');
    }
    const transactionReference = (body.transactionReference ?? '').trim();
    if (!transactionReference || transactionReference.length > 35) {
      throw new BadRequestException('transactionReference is required (max 35 characters)');
    }
    const transactionDate = body.transactionDate?.trim();
    if (!transactionDate) {
      throw new BadRequestException('transactionDate is required');
    }
    const data = await this.postpaidSchemePaymentService.create(
      schemeId,
      {
        amount,
        paymentType,
        transactionReference,
        transactionDate,
      },
      file.buffer,
      userId,
      correlationId ?? 'unknown'
    );
    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'Postpaid scheme payment created successfully',
      data,
    };
  }
}

