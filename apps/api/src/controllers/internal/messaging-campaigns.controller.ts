import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { User } from '../../decorators/user.decorator';
import { AuthenticatedUser } from '../../types/express';
import { ErrorCodes } from '../../enums/error-codes.enum';
import { CampaignComposeRequestDto } from '../../dto/messaging/campaign.dto';
import { CampaignService } from '../../modules/messaging/campaigns/campaign.service';

@ApiTags('Internal - Messaging Campaigns')
@ApiBearerAuth()
@Controller('internal/messaging/campaigns')
export class MessagingCampaignsController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview campaign preflight (no history row)' })
  async preview(
    @User() user: AuthenticatedUser,
    @Body() body: CampaignComposeRequestDto,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);
    const data = await this.campaignService.preview(body, user.id);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Campaign preview computed',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send campaign (DELAYED or FAILED_PREFLIGHT)' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async create(
    @User() user: AuthenticatedUser,
    @Body() body: CampaignComposeRequestDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);
    const data = await this.campaignService.create(body, user.id, {
      idempotencyKey: idempotencyKey?.trim() ? idempotencyKey.trim() : undefined,
      correlationId,
    });
    if ((data as { _failedPreflight?: boolean })._failedPreflight) {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          correlationId: correlationId ?? 'unknown',
          message: 'Campaign failed preflight',
          data,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'Campaign created',
      data,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List campaigns' })
  async list(
    @User() user: AuthenticatedUser,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);
    const result = await this.campaignService.list({
      channel,
      status,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Campaigns listed',
      ...result,
    };
  }

  @Get(':campaignId/errors.csv')
  @ApiOperation({ summary: 'Download blocking-error CSV' })
  async errorsCsv(
    @User() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertSupportOrAdmin(user);
    const csv = await this.campaignService.getCsv(campaignId, 'errors');
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campaign-${campaignId}-errors.csv"`,
    });
    return csv;
  }

  @Get(':campaignId/skips.csv')
  @ApiOperation({ summary: 'Download soft-skip CSV' })
  async skipsCsv(
    @User() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertSupportOrAdmin(user);
    const csv = await this.campaignService.getCsv(campaignId, 'skips');
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campaign-${campaignId}-skips.csv"`,
    });
    return csv;
  }

  @Post(':campaignId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel delayed or in-flight campaign' })
  async cancel(
    @User() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);
    const data = await this.campaignService.cancel(campaignId, user.id);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Campaign cancelled',
      data,
    };
  }

  @Get(':campaignId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get campaign detail' })
  async get(
    @User() user: AuthenticatedUser,
    @Param('campaignId') campaignId: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);
    const data = await this.campaignService.getById(campaignId);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Campaign retrieved',
      data,
    };
  }

  private assertSupportOrAdmin(user: AuthenticatedUser) {
    const roles = user?.roles ?? [];
    if (roles.includes('registration_admin') || roles.includes('customer_care')) return;
    throw new ForbiddenException({
      error: { code: ErrorCodes.AUTHORIZATION_ERROR, message: 'Insufficient permissions' },
    });
  }

  private assertAdmin(user: AuthenticatedUser) {
    const roles = user?.roles ?? [];
    if (roles.includes('registration_admin')) return;
    throw new ForbiddenException({
      error: { code: ErrorCodes.INSUFFICIENT_PERMISSIONS, message: 'Admin role required' },
    });
  }
}
