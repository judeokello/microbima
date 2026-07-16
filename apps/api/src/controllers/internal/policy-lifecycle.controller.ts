import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { PolicyLifecycleService } from '../../services/policy-lifecycle.service';
import { PolicyLifecycleJobService } from '../../services/policy-lifecycle-job.service';
import { MpesaPaymentsService } from '../../services/mpesa-payments.service';
import {
  ActivatePolicyRequestDto,
  DailyLifecycleRunResponseDto,
  DeactivatePolicyRequestDto,
  ModifyPolicyOptionsResponseDto,
  ModifyPolicyRequestDto,
  PolicyLifecycleResponseDto,
  RemapMpesaPaymentsRequestDto,
  RemapMpesaPaymentsResponseDto,
  ResetPolicyStartDateRequestDto,
  TerminatePolicyRequestDto,
  UnmappedMpesaPaymentsResponseDto,
} from '../../dto/policy-lifecycle/policy-lifecycle.dto';

@ApiTags('Internal - Policy Lifecycle')
@ApiBearerAuth()
@Controller('internal/customers')
export class PolicyLifecycleController {
  constructor(
    private readonly policyLifecycleService: PolicyLifecycleService,
    private readonly policyLifecycleJobService: PolicyLifecycleJobService,
    private readonly mpesaPaymentsService: MpesaPaymentsService
  ) {}

  @Post(':customerId/policies/:policyId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate policy (admin)' })
  @ApiParam({ name: 'customerId' })
  @ApiParam({ name: 'policyId' })
  @ApiResponse({ status: 200, type: PolicyLifecycleResponseDto })
  async deactivatePolicy(
    @Param('customerId') customerId: string,
    @Param('policyId') policyId: string,
    @Body() body: DeactivatePolicyRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<PolicyLifecycleResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.policyLifecycleService.deactivatePolicy(
      customerId,
      policyId,
      body,
      userId,
      userRoles,
      correlationId
    );
  }

  @Post(':customerId/policies/:policyId/terminate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminate policy (admin; starter blacklist)' })
  @ApiParam({ name: 'customerId' })
  @ApiParam({ name: 'policyId' })
  @ApiResponse({ status: 200, type: PolicyLifecycleResponseDto })
  async terminatePolicy(
    @Param('customerId') customerId: string,
    @Param('policyId') policyId: string,
    @Body() body: TerminatePolicyRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<PolicyLifecycleResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.policyLifecycleService.terminatePolicy(
      customerId,
      policyId,
      body,
      userId,
      userRoles,
      correlationId
    );
  }

  @Post(':customerId/policies/:policyId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate suspended policy (admin)' })
  @ApiParam({ name: 'customerId' })
  @ApiParam({ name: 'policyId' })
  @ApiResponse({ status: 200, type: PolicyLifecycleResponseDto })
  async activatePolicy(
    @Param('customerId') customerId: string,
    @Param('policyId') policyId: string,
    @Body() body: ActivatePolicyRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<PolicyLifecycleResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.policyLifecycleService.activatePolicy(
      customerId,
      policyId,
      body,
      userId,
      userRoles,
      correlationId
    );
  }

  @Post(':customerId/policies/:policyId/reset-start-date')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset policy start/end dates (admin)' })
  @ApiParam({ name: 'customerId' })
  @ApiParam({ name: 'policyId' })
  @ApiResponse({ status: 200, type: PolicyLifecycleResponseDto })
  async resetStartDate(
    @Param('customerId') customerId: string,
    @Param('policyId') policyId: string,
    @Body() body: ResetPolicyStartDateRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<PolicyLifecycleResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.policyLifecycleService.resetPolicyStartDate(
      customerId,
      policyId,
      body,
      userId,
      userRoles,
      correlationId
    );
  }

  @Get(':customerId/policies/:policyId/unmapped-mpesa-payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List unmapped M-Pesa payments by wrong account number (admin remap)' })
  @ApiParam({ name: 'customerId' })
  @ApiParam({ name: 'policyId' })
  @ApiQuery({ name: 'accountNumber', required: true })
  @ApiResponse({ status: 200, type: UnmappedMpesaPaymentsResponseDto })
  async listUnmappedMpesaPayments(
    @Param('customerId') customerId: string,
    @Param('policyId') policyId: string,
    @Query('accountNumber') accountNumber: string,
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<UnmappedMpesaPaymentsResponseDto> {
    const userRoles = req.user?.roles ?? [];
    this.policyLifecycleService.assertAdmin(userRoles);
    const result = await this.mpesaPaymentsService.listUnmappedMpesaPaymentsForRemap(
      customerId,
      policyId,
      accountNumber ?? '',
      correlationId
    );
    return {
      status: 200,
      correlationId,
      items: result.items,
    };
  }

  @Post(':customerId/policies/:policyId/remap-mpesa-payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remap selected unmapped M-Pesa payments onto this policy (admin)' })
  @ApiParam({ name: 'customerId' })
  @ApiParam({ name: 'policyId' })
  @ApiResponse({ status: 200, type: RemapMpesaPaymentsResponseDto })
  async remapMpesaPayments(
    @Param('customerId') customerId: string,
    @Param('policyId') policyId: string,
    @Body() body: RemapMpesaPaymentsRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<RemapMpesaPaymentsResponseDto> {
    const userRoles = req.user?.roles ?? [];
    this.policyLifecycleService.assertAdmin(userRoles);
    const result = await this.mpesaPaymentsService.remapMpesaPaymentsToPolicy(
      customerId,
      policyId,
      {
        accountNumber: body.accountNumber,
        itemIds: body.itemIds,
        reason: body.reason,
      },
      correlationId
    );
    return {
      status: 200,
      correlationId,
      message: result.message,
      mappedCount: result.mappedCount,
      totalAmount: result.totalAmount,
      lifecycleAction: result.lifecycleAction,
      note: result.note,
    };
  }

  @Get(':customerId/policies/:policyId/modify-options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get modify-product options (admin)' })
  @ApiParam({ name: 'customerId' })
  @ApiParam({ name: 'policyId' })
  @ApiResponse({ status: 200, type: ModifyPolicyOptionsResponseDto })
  async getModifyOptions(
    @Param('customerId') customerId: string,
    @Param('policyId') policyId: string,
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<ModifyPolicyOptionsResponseDto> {
    const userRoles = req.user?.roles ?? [];
    return this.policyLifecycleService.getModifyOptions(
      customerId,
      policyId,
      userRoles,
      correlationId
    );
  }

  @Post(':customerId/policies/:policyId/modify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Modify product — deactivate and recreate policy (admin)' })
  @ApiParam({ name: 'customerId' })
  @ApiParam({ name: 'policyId' })
  @ApiResponse({ status: 200, type: PolicyLifecycleResponseDto })
  async modifyPolicy(
    @Param('customerId') customerId: string,
    @Param('policyId') policyId: string,
    @Body() body: ModifyPolicyRequestDto,
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<PolicyLifecycleResponseDto> {
    const userId = req.user?.id ?? 'system';
    const userRoles = req.user?.roles ?? [];
    return this.policyLifecycleService.modifyPolicy(
      customerId,
      policyId,
      body,
      userId,
      userRoles,
      correlationId
    );
  }
}

@ApiTags('Internal - Policy Lifecycle')
@ApiBearerAuth()
@Controller('internal/policies/lifecycle')
export class PolicyLifecycleOpsController {
  constructor(
    private readonly policyLifecycleService: PolicyLifecycleService,
    private readonly policyLifecycleJobService: PolicyLifecycleJobService
  ) {}

  @Post('run-daily')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run daily policy lifecycle evaluation once (admin/ops)' })
  @ApiResponse({ status: 200, type: DailyLifecycleRunResponseDto })
  async runDaily(
    @CorrelationId() correlationId: string,
    @Req() req: Request
  ): Promise<DailyLifecycleRunResponseDto> {
    const userRoles = req.user?.roles ?? [];
    this.policyLifecycleService.assertAdmin(userRoles);
    return this.policyLifecycleJobService.runDaily(correlationId);
  }
}
