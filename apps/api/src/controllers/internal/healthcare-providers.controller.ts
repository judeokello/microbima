import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import {
  HealthcareProviderListResponseDto,
  PackageProviderPanelListResponseDto,
} from '../../dto/healthcare-providers/healthcare-provider.dto';
import { HealthcareProviderService } from '../../services/healthcare-provider.service';

@ApiTags('Internal - Healthcare Providers')
@ApiBearerAuth()
@Controller('internal/healthcare-providers')
export class HealthcareProvidersController {
  constructor(private readonly healthcareProviderService: HealthcareProviderService) {}

  /**
   * GET /internal/healthcare-providers/packages
   * Packages with provider panel counts (agent dashboard landing).
   */
  @Get('packages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List packages with provider panel counts',
    description:
      'Returns active packages and the number of active healthcare providers on each package panel.',
  })
  @ApiResponse({
    status: 200,
    description: 'Package panels retrieved successfully',
    type: PackageProviderPanelListResponseDto,
  })
  async listPackagePanels(
    @CorrelationId() correlationId?: string,
  ): Promise<PackageProviderPanelListResponseDto> {
    const data = await this.healthcareProviderService.listPackagePanels(
      correlationId ?? 'unknown',
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Package provider panels retrieved successfully',
      data,
    };
  }

  /**
   * GET /internal/healthcare-providers/packages/:packageId/providers
   */
  @Get('packages/:packageId/providers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List providers for a package panel',
    description:
      'Paginated provider list for a package. Supports optional case-insensitive name search. Default page size is 20.',
  })
  @ApiParam({ name: 'packageId', type: Number, example: 1 })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Filter providers by name (case-insensitive contains)',
  })
  @ApiResponse({
    status: 200,
    description: 'Providers retrieved successfully',
    type: HealthcareProviderListResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async listPackageProviders(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @CorrelationId() correlationId?: string,
  ): Promise<HealthcareProviderListResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    const result = await this.healthcareProviderService.listPackageProviders(
      packageId,
      Number.isFinite(pageNum) ? pageNum : 1,
      Number.isFinite(pageSizeNum) ? pageSizeNum : 20,
      search,
      correlationId ?? 'unknown',
    );

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Package providers retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    };
  }

  /**
   * GET /internal/healthcare-providers/packages/:packageId/providers/export
   */
  @Get('packages/:packageId/providers/export')
  @ApiOperation({
    summary: 'Download package provider panel as CSV',
    description: 'Exports the full active provider panel for a package as CSV.',
  })
  @ApiParam({ name: 'packageId', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'CSV file' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async exportPackageProviders(
    @Param('packageId', ParseIntPipe) packageId: number,
    @Res({ passthrough: true }) res: Response,
    @CorrelationId() correlationId?: string,
  ): Promise<StreamableFile> {
    const { filename, buffer } =
      await this.healthcareProviderService.exportPackageProvidersCsv(
        packageId,
        correlationId ?? 'unknown',
      );

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(buffer);
  }
}
