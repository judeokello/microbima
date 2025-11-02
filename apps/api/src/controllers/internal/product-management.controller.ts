import {
  Controller,
  Get,
  Post,
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
import {
  PackagesResponseDto,
  SchemesResponseDto,
  PlansResponseDto,
  TagsResponseDto,
  CreateTagRequestDto,
  CreateTagResponseDto,
  SearchTagsQueryDto,
} from '../../dto/product-management/product-management.dto';
import { CorrelationId } from '../../decorators/correlation-id.decorator';

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
  constructor(private readonly productManagementService: ProductManagementService) {}

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
}

