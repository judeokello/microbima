import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerPortalPinCompleteDto } from './dto/pin-complete.dto';
import { SupabaseCustomerGuard } from './guards/supabase-customer.guard';

@ApiTags('customer-portal')
@Controller('internal/customer-portal')
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  private correlation(req: Request): string {
    const h = req.headers['x-correlation-id'];
    return typeof h === 'string' && h.length > 0 ? h : randomUUID();
  }

  @Get('me/context')
  @ApiOperation({ summary: 'Deep-link login display context (uniform 200; no enumeration)' })
  @ApiResponse({ status: 200 })
  async getLoginContext(@Query('customerId') customerId: string | undefined, @Req() req: Request) {
    if (!customerId?.trim()) {
      throw new BadRequestException('customerId is required');
    }
    const correlationId = this.correlation(req);
    return this.customerPortalService.getLoginDisplayContext(customerId.trim(), correlationId);
  }

  @Get('me/portal-status')
  @UseGuards(SupabaseCustomerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether first-time PIN setup is complete for the signed-in customer' })
  @ApiResponse({ status: 200 })
  async getPortalStatus(@Req() req: Request) {
    const customerId = req.customerPortalUserId!;
    const correlationId = this.correlation(req);
    return this.customerPortalService.getPortalSetupStatus(customerId, correlationId);
  }

  @Post('me/pin-complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseCustomerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete first-time PIN setup' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 422 })
  async completePin(@Body() body: CustomerPortalPinCompleteDto, @Req() req: Request): Promise<void> {
    const customerId = req.customerPortalUserId!;
    const correlationId = this.correlation(req);
    await this.customerPortalService.completePinSetup(customerId, body.pin, body.pinConfirm, correlationId);
  }

  // ── Self-service read endpoints (customer JWT, sub === customerId) ──────────

  @Get('me/policies')
  @UseGuards(SupabaseCustomerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Policy dropdown list for the signed-in customer (payments filter)' })
  @ApiResponse({ status: 200 })
  async getPortalPolicies(@Req() req: Request) {
    const customerId = req.customerPortalUserId!;
    return this.customerPortalService.getPortalPolicies(customerId, this.correlation(req));
  }

  @Get('me/products')
  @UseGuards(SupabaseCustomerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rich products list for the signed-in customer' })
  @ApiResponse({ status: 200 })
  async getPortalProducts(@Req() req: Request) {
    const customerId = req.customerPortalUserId!;
    return this.customerPortalService.getPortalPoliciesList(customerId, this.correlation(req));
  }

  @Get('me/products/:policyId')
  @UseGuards(SupabaseCustomerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Policy detail for the signed-in customer' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async getPortalProductDetail(@Param('policyId') policyId: string, @Req() req: Request) {
    const customerId = req.customerPortalUserId!;
    return this.customerPortalService.getPortalPolicyDetail(customerId, policyId, this.correlation(req));
  }

  @Get('me/payments')
  @UseGuards(SupabaseCustomerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Payment history for the signed-in customer' })
  @ApiResponse({ status: 200 })
  async getPortalPayments(
    @Query('policyId') policyId: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Req() req: Request,
  ) {
    const customerId = req.customerPortalUserId!;
    return this.customerPortalService.getPortalPayments(
      customerId,
      { policyId, fromDate, toDate },
      this.correlation(req),
    );
  }

  @Get('me/member-cards')
  @UseGuards(SupabaseCustomerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Member cards for the signed-in customer' })
  @ApiResponse({ status: 200 })
  async getPortalMemberCards(@Req() req: Request) {
    const customerId = req.customerPortalUserId!;
    return this.customerPortalService.getPortalMemberCards(customerId, this.correlation(req));
  }
}
