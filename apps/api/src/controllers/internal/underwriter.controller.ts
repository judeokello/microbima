import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UnderwriterService } from '../../services/underwriter.service';
import {
  UnderwriterListResponseDto,
  UnderwriterResponseDto,
  UnderwriterPackagesResponseDto,
  CreateUnderwriterRequestDto,
  UpdateUnderwriterRequestDto,
} from '../../dto/underwriters/underwriter.dto';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { UserId } from '../../decorators/user.decorator';

/**
 * Internal Underwriter Controller
 *
 * Handles HTTP requests for underwriter management operations.
 * These endpoints are used by internal admin operations and require Bearer token authentication.
 *
 * Features:
 * - Underwriter CRUD operations
 * - Package listing with counts for underwriters
 * - Pagination support
 * - Swagger API documentation
 * - Correlation ID tracking
 */
@ApiTags('Internal - Underwriter Management')
@ApiBearerAuth()
@Controller('internal/underwriters')
export class UnderwriterController {
  constructor(private readonly underwriterService: UnderwriterService) {}

  /**
   * Get all underwriters with pagination
   * GET /internal/underwriters
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all underwriters',
    description: 'Retrieve a paginated list of all underwriters.',
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
    description: 'Underwriters retrieved successfully',
    type: UnderwriterListResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUnderwriters(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CorrelationId() correlationId?: string
  ): Promise<UnderwriterListResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    const result = await this.underwriterService.getUnderwriters(
      pageNum,
      pageSizeNum,
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Underwriters retrieved successfully',
      ...result,
    };
  }

  /**
   * Get underwriter by ID
   * GET /internal/underwriters/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get underwriter by ID',
    description: 'Retrieve details of a specific underwriter.',
  })
  @ApiParam({
    name: 'id',
    description: 'Underwriter ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Underwriter retrieved successfully',
    type: UnderwriterResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Underwriter not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUnderwriterById(
    @Param('id', ParseIntPipe) id: number,
    @CorrelationId() correlationId?: string
  ): Promise<UnderwriterResponseDto> {
    const underwriter = await this.underwriterService.getUnderwriterById(
      id,
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Underwriter retrieved successfully',
      data: underwriter,
    };
  }

  /**
   * Create a new underwriter
   * POST /internal/underwriters
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new underwriter',
    description: 'Create a new underwriter. The logged-in user will be set as the creator.',
  })
  @ApiResponse({
    status: 201,
    description: 'Underwriter created successfully',
    type: UnderwriterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createUnderwriter(
    @Body() createRequest: CreateUnderwriterRequestDto,
    @UserId() userId: string,
    @CorrelationId() correlationId?: string
  ): Promise<UnderwriterResponseDto> {
    const underwriter = await this.underwriterService.createUnderwriter(
      {
        name: createRequest.name,
        shortName: createRequest.shortName,
        website: createRequest.website,
        officeLocation: createRequest.officeLocation,
        logoPath: createRequest.logoPath,
        isActive: createRequest.isActive,
      },
      userId,
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'Underwriter created successfully',
      data: underwriter,
    };
  }

  /**
   * Update an underwriter
   * PUT /internal/underwriters/:id
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an underwriter',
    description: 'Update an existing underwriter. Only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Underwriter ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Underwriter updated successfully',
    type: UnderwriterResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Underwriter not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updateUnderwriter(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRequest: UpdateUnderwriterRequestDto,
    @CorrelationId() correlationId?: string
  ): Promise<UnderwriterResponseDto> {
    const underwriter = await this.underwriterService.updateUnderwriter(
      id,
      {
        name: updateRequest.name,
        shortName: updateRequest.shortName,
        website: updateRequest.website,
        officeLocation: updateRequest.officeLocation,
        logoPath: updateRequest.logoPath,
        isActive: updateRequest.isActive,
      },
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Underwriter updated successfully',
      data: underwriter,
    };
  }

  /**
   * Get packages for an underwriter
   * GET /internal/underwriters/:id/packages
   */
  @Get(':id/packages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get packages for an underwriter',
    description: 'Retrieve all packages for a specific underwriter with scheme counts and total customers.',
  })
  @ApiParam({
    name: 'id',
    description: 'Underwriter ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Packages retrieved successfully',
    type: UnderwriterPackagesResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Underwriter not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUnderwriterPackages(
    @Param('id', ParseIntPipe) id: number,
    @CorrelationId() correlationId?: string
  ): Promise<UnderwriterPackagesResponseDto> {
    const packages = await this.underwriterService.getUnderwriterPackages(
      id,
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Packages retrieved successfully',
      data: packages,
    };
  }
}

