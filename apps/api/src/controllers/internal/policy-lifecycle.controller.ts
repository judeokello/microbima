import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { PolicyLifecycleService } from '../../services/policy-lifecycle.service';
import {
  ActivatePolicyRequestDto,
  DeactivatePolicyRequestDto,
  ModifyPolicyOptionsResponseDto,
  ModifyPolicyRequestDto,
  PolicyLifecycleResponseDto,
  ResetPolicyStartDateRequestDto,
} from '../../dto/policy-lifecycle/policy-lifecycle.dto';

@ApiTags('Internal - Policy Lifecycle')
@ApiBearerAuth()
@Controller('internal/customers')
export class PolicyLifecycleController {
  constructor(private readonly policyLifecycleService: PolicyLifecycleService) {}

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
