/// <reference types="multer" />
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { MpesaPaymentsService } from '../../services/mpesa-payments.service';
import {
  MpesaPaymentUploadResponseDto,
  MpesaPaymentReportUploadListResponseDto,
  MpesaPaymentReportUploadDetailsResponseDto,
} from '../../dto/mpesa-payments';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { UserId } from '../../decorators/user.decorator';

/**
 * Internal MPESA Payments Controller
 *
 * Handles HTTP requests for MPESA payment statement uploads and management.
 * These endpoints are used by internal admin operations and require Bearer token authentication.
 *
 * Features:
 * - Upload MPESA statement Excel files
 * - List uploads with pagination
 * - Get upload details with transaction items
 * - Swagger API documentation
 * - Correlation ID tracking
 */
@ApiTags('Internal - MPESA Payments')
@ApiBearerAuth()
@Controller('internal/mpesa-payments')
export class MpesaPaymentsController {
  constructor(private readonly mpesaPaymentsService: MpesaPaymentsService) {}

  /**
   * Upload MPESA statement file
   * POST /internal/mpesa-payments/upload
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload MPESA statement file',
    description: 'Upload and parse an MPESA payment statement Excel file (.xls or .xlsx).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'MPESA statement Excel file (.xls or .xlsx)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded and parsed successfully',
    type: MpesaPaymentUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or parsing error',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async uploadStatement(
    @UploadedFile() file: Express.Multer.File,
    @UserId() userId: string,
    @CorrelationId() correlationId?: string
  ): Promise<MpesaPaymentUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.mpesaPaymentsService.uploadAndParseStatement(
      file,
      userId,
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'File uploaded and parsed successfully',
      ...result,
    };
  }

  /**
   * Get list of uploads
   * GET /internal/mpesa-payments/uploads
   */
  @Get('uploads')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get list of MPESA payment uploads',
    description: 'Retrieve a paginated list of all MPESA payment statement uploads.',
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
    description: 'Uploads retrieved successfully',
    type: MpesaPaymentReportUploadListResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUploads(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CorrelationId() correlationId?: string
  ): Promise<MpesaPaymentReportUploadListResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    const result = await this.mpesaPaymentsService.getUploads(
      pageNum,
      pageSizeNum,
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Uploads retrieved successfully',
      ...result,
    };
  }

  /**
   * Get upload details with transaction items
   * GET /internal/mpesa-payments/uploads/:id
   */
  @Get('uploads/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get upload details',
    description: 'Retrieve details of a specific MPESA payment upload with its transaction items.',
  })
  @ApiParam({
    name: 'id',
    description: 'Upload ID',
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for transaction items (default: 1)',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    description: 'Items per page for transaction items (default: 20, max: 100)',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Upload details retrieved successfully',
    type: MpesaPaymentReportUploadDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Upload not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUploadDetails(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CorrelationId() correlationId?: string
  ): Promise<MpesaPaymentReportUploadDetailsResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    const result = await this.mpesaPaymentsService.getUploadDetails(
      id,
      pageNum,
      pageSizeNum,
      correlationId ?? 'unknown'
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Upload details retrieved successfully',
      ...result,
    };
  }
}

