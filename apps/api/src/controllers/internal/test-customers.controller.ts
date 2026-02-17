import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TestCustomersService } from '../../services/test-customers.service';
import {
  CreateTestCustomerDto,
  TestCustomerResponseDto,
  TestCustomerListResponseDto,
} from '../../dto/test-customers';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { AdminOnly } from '../../decorators/ba-auth.decorator';

/**
 * Internal Test Customers Controller
 *
 * Manages test customer phone numbers. When a customer is created with a phone
 * number that exists in test_customers, the customer is marked is_test_user=true.
 * Registration admin only.
 */
@ApiTags('Internal - Test Customers')
@ApiBearerAuth()
@Controller('internal/test-customers')
export class TestCustomersController {
  constructor(private readonly testCustomersService: TestCustomersService) {}

  @Get()
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List test customers',
    description: 'Returns paginated list of test customer phone numbers. Registration admin only.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'List of test customers',
    type: TestCustomerListResponseDto,
  })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CorrelationId() correlationId?: string
  ): Promise<TestCustomerListResponseDto> {
    const result = await this.testCustomersService.list(
      {
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      },
      correlationId ?? 'unknown'
    );

    return {
      data: result.data.map((item) => ({
        id: item.id,
        name: item.name,
        phoneNumber: item.phoneNumber,
        createdAt: item.createdAt.toISOString(),
        createdBy: item.createdBy,
      })),
      pagination: result.pagination,
    };
  }

  @Post()
  @AdminOnly()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create test customer',
    description: 'Add a phone number to the test customers registry. Registration admin only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Test customer created',
    type: TestCustomerResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate phone' })
  async create(
    @Body() dto: CreateTestCustomerDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request & { user?: { id?: string } }
  ): Promise<TestCustomerResponseDto> {
    const userId = req.user?.id;
    const created = await this.testCustomersService.create(
      dto,
      userId,
      correlationId ?? 'unknown'
    );

    return {
      id: created.id,
      name: created.name,
      phoneNumber: created.phoneNumber,
      createdAt: created.createdAt.toISOString(),
      createdBy: created.createdBy,
    };
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete test customer',
    description: 'Remove a phone number from the test customers registry. Registration admin only.',
  })
  @ApiParam({ name: 'id', description: 'Test customer ID' })
  @ApiResponse({ status: 204, description: 'Test customer deleted' })
  @ApiResponse({ status: 404, description: 'Test customer not found' })
  async delete(
    @Param('id') id: string,
    @CorrelationId() correlationId: string
  ): Promise<void> {
    await this.testCustomersService.delete(id, correlationId ?? 'unknown');
  }
}
