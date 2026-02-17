import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from '../../modules/messaging/messaging.service';
import { SystemSettingsService } from '../../modules/messaging/settings/system-settings.service';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { User } from '../../decorators/user.decorator';
import { AuthenticatedUser } from '../../types/express';
import { ErrorCodes } from '../../enums/error-codes.enum';
import { ValidationException } from '../../exceptions/validation.exception';
import { MessagingSettingsSnapshot } from '../../modules/messaging/messaging.types';
import { MessagingTemplatesService } from '../../modules/messaging/messaging-templates.service';
import { MessagingRoutesService } from '../../modules/messaging/messaging-routes.service';
import { MessagingAttachmentTemplatesService } from '../../modules/messaging/messaging-attachment-templates.service';
import { Prisma } from '@prisma/client';
import { MessagingAttachmentTemplateType } from '@prisma/client';

@ApiTags('Internal - Messaging')
@ApiBearerAuth()
@Controller('internal/messaging')
export class InternalMessagingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly systemSettings: SystemSettingsService,
    private readonly templates: MessagingTemplatesService,
    private readonly routes: MessagingRoutesService,
    private readonly attachmentTemplates: MessagingAttachmentTemplatesService,
  ) {}

  @Get('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get messaging system settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved' })
  async getSettings(@User() user: AuthenticatedUser, @CorrelationId() correlationId?: string) {
    this.assertSupportOrAdmin(user);
    const rows = await this.systemSettings.listSettings();
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Messaging settings retrieved successfully',
      data: rows,
    };
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update messaging system settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(
    @User() user: AuthenticatedUser,
    @Body() body: Partial<MessagingSettingsSnapshot> & Record<string, unknown>,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);

    const validationErrors: Record<string, string> = {};

    if (body.systemSettingsCacheRefreshSeconds !== undefined) {
      const n = Number(body.systemSettingsCacheRefreshSeconds);
      if (!Number.isFinite(n) || n <= 0) validationErrors['systemSettingsCacheRefreshSeconds'] = 'Must be a positive number';
      if (n > 120) validationErrors['systemSettingsCacheRefreshSeconds'] = 'Must be <= 120 to satisfy the 2-minute propagation SLA';
    }
    if (body.workerPollIntervalSeconds !== undefined) {
      const n = Number(body.workerPollIntervalSeconds);
      if (!Number.isFinite(n) || n <= 0) validationErrors['workerPollIntervalSeconds'] = 'Must be a positive number';
    }
    if (body.workerBatchSize !== undefined) {
      const n = Number(body.workerBatchSize);
      if (!Number.isFinite(n) || n <= 0) validationErrors['workerBatchSize'] = 'Must be a positive number';
    }
    if (body.workerMaxConcurrency !== undefined) {
      const n = Number(body.workerMaxConcurrency);
      if (!Number.isFinite(n) || n <= 0) validationErrors['workerMaxConcurrency'] = 'Must be a positive number';
    }
    if (body.messagingAttachmentRetentionMonths !== undefined) {
      const n = Number(body.messagingAttachmentRetentionMonths);
      if (!Number.isFinite(n) || n < 0) validationErrors['messagingAttachmentRetentionMonths'] = 'Must be 0 (never) or a positive number of months';
    }
    if (body.messagingContentRetentionMonths !== undefined) {
      const n = Number(body.messagingContentRetentionMonths);
      if (!Number.isFinite(n) || n < 0) validationErrors['messagingContentRetentionMonths'] = 'Must be 0 (never) or a positive number of months';
    }

    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors, ErrorCodes.VALIDATION_ERROR);
    }

    await this.systemSettings.updateSettings(body, user.id);
    const rows = await this.systemSettings.listSettings();
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Messaging settings updated successfully',
      data: rows,
    };
  }

  @Get('templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List message templates' })
  async listTemplates(
    @User() user: AuthenticatedUser,
    @Query('templateKey') templateKey?: string,
    @Query('channel') channel?: 'SMS' | 'EMAIL',
    @Query('language') language?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);
    const where: Prisma.MessagingTemplateWhereInput = {};
    if (templateKey) where.templateKey = templateKey;
    if (channel) where.channel = channel;
    if (language) where.language = language;
    const rows = await this.templates.list(where);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Messaging templates retrieved successfully',
      data: rows,
    };
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a message template' })
  async createTemplate(
    @User() user: AuthenticatedUser,
    @Body()
    body: {
      templateKey: string;
      channel: 'SMS' | 'EMAIL';
      language: string;
      subject?: string;
      body: string;
      textBody?: string;
      placeholders?: string[];
      description?: string | null;
      isActive?: boolean;
    },
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);

    const validationErrors: Record<string, string> = {};
    if (!body.templateKey) validationErrors['templateKey'] = 'Required';
    if (!body.channel) validationErrors['channel'] = 'Required';
    if (!body.language) validationErrors['language'] = 'Required';
    if (!body.body) validationErrors['body'] = 'Required';
    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors, ErrorCodes.REQUIRED_FIELD_MISSING);
    }

    const created = await this.templates.create({
      templateKey: body.templateKey,
      channel: body.channel,
      language: body.language,
      subject: body.subject ?? null,
      body: body.body,
      textBody: body.textBody ?? null,
      placeholders: body.placeholders ?? [],
      description: body.description ?? null,
      isActive: body.isActive ?? true,
      createdBy: user.id,
      updatedBy: user.id,
    });

    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'Messaging template created successfully',
      data: created,
    };
  }

  @Get('templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a template by ID' })
  async getTemplate(
    @User() user: AuthenticatedUser,
    @Param('templateId') templateId: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);
    const row = await this.templates.getById(templateId);
    if (!row) {
      throw new NotFoundException({ error: { code: ErrorCodes.NOT_FOUND, message: 'Template not found' } });
    }
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Messaging template retrieved successfully',
      data: row,
    };
  }

  @Patch('templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a template' })
  async updateTemplate(
    @User() user: AuthenticatedUser,
    @Param('templateId') templateId: string,
    @Body()
    body: {
      subject?: string | null;
      body?: string;
      textBody?: string | null;
      placeholders?: string[];
      description?: string | null;
      isActive?: boolean;
    },
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);

    const updated = await this.templates.update(templateId, {
      subject: body.subject === undefined ? undefined : body.subject,
      body: body.body,
      textBody: body.textBody === undefined ? undefined : body.textBody,
      placeholders: body.placeholders,
      description: body.description === undefined ? undefined : body.description,
      isActive: body.isActive,
      updatedBy: user.id,
    });

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Messaging template updated successfully',
      data: updated,
    };
  }

  @Get('attachment-templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List attachment templates (optionally by templateKey)' })
  async listAttachmentTemplates(
    @User() user: AuthenticatedUser,
    @Query('templateKey') templateKey?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);
    const where: Prisma.MessagingAttachmentTemplateWhereInput = {};
    if (templateKey) where.templateKey = templateKey;
    const rows = await this.attachmentTemplates.list(where);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Attachment templates retrieved successfully',
      data: rows,
    };
  }

  @Post('attachment-templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an attachment template' })
  async createAttachmentTemplate(
    @User() user: AuthenticatedUser,
    @Body()
    body: {
      templateKey: string;
      name: string;
      templatePath: string;
      attachmentType: MessagingAttachmentTemplateType;
      parameterSpec: Record<string, string>;
      description?: string | null;
      isActive?: boolean;
    },
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);

    const validationErrors: Record<string, string> = {};
    if (!body.templateKey) validationErrors['templateKey'] = 'Required';
    if (!body.name) validationErrors['name'] = 'Required';
    if (!body.templatePath) validationErrors['templatePath'] = 'Required';
    if (!body.attachmentType) validationErrors['attachmentType'] = 'Required';
    if (body.parameterSpec === undefined) validationErrors['parameterSpec'] = 'Required';
    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors, ErrorCodes.REQUIRED_FIELD_MISSING);
    }

    const created = await this.attachmentTemplates.create({
      templateKey: body.templateKey,
      name: body.name,
      templatePath: body.templatePath,
      attachmentType: body.attachmentType,
      parameterSpec: body.parameterSpec,
      description: body.description ?? null,
      isActive: body.isActive ?? true,
      createdBy: user.id,
      updatedBy: user.id,
    });

    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'Attachment template created successfully',
      data: created,
    };
  }

  @Get('attachment-templates/:attachmentTemplateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get an attachment template by ID' })
  async getAttachmentTemplate(
    @User() user: AuthenticatedUser,
    @Param('attachmentTemplateId') attachmentTemplateId: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);
    const row = await this.attachmentTemplates.getById(attachmentTemplateId);
    if (!row) {
      throw new NotFoundException({ error: { code: ErrorCodes.NOT_FOUND, message: 'Attachment template not found' } });
    }
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Attachment template retrieved successfully',
      data: row,
    };
  }

  @Patch('attachment-templates/:attachmentTemplateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an attachment template' })
  async updateAttachmentTemplate(
    @User() user: AuthenticatedUser,
    @Param('attachmentTemplateId') attachmentTemplateId: string,
    @Body()
    body: {
      name?: string;
      templatePath?: string;
      attachmentType?: MessagingAttachmentTemplateType;
      parameterSpec?: Record<string, string>;
      description?: string | null;
      isActive?: boolean;
    },
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);

    const updated = await this.attachmentTemplates.update(attachmentTemplateId, {
      name: body.name,
      templatePath: body.templatePath,
      attachmentType: body.attachmentType,
      parameterSpec: body.parameterSpec,
      description: body.description,
      isActive: body.isActive,
      updatedBy: user.id,
    });

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Attachment template updated successfully',
      data: updated,
    };
  }

  @Get('routes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List messaging routes' })
  async listRoutes(@User() user: AuthenticatedUser, @CorrelationId() correlationId?: string) {
    this.assertSupportOrAdmin(user);
    const rows = await this.routes.list();
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Messaging routes retrieved successfully',
      data: rows,
    };
  }

  @Put('routes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert a messaging route' })
  async upsertRoute(
    @User() user: AuthenticatedUser,
    @Body()
    body: { templateKey: string; smsEnabled: boolean; emailEnabled: boolean; isActive?: boolean },
    @CorrelationId() correlationId?: string,
  ) {
    this.assertAdmin(user);

    const validationErrors: Record<string, string> = {};
    if (!body.templateKey) validationErrors['templateKey'] = 'Required';
    if (body.smsEnabled === undefined) validationErrors['smsEnabled'] = 'Required';
    if (body.emailEnabled === undefined) validationErrors['emailEnabled'] = 'Required';
    if (Object.keys(validationErrors).length > 0) {
      throw ValidationException.withMultipleErrors(validationErrors, ErrorCodes.REQUIRED_FIELD_MISSING);
    }

    const row = await this.routes.upsertByTemplateKey(body.templateKey, {
      smsEnabled: body.smsEnabled,
      emailEnabled: body.emailEnabled,
      isActive: body.isActive ?? true,
      createdBy: user.id,
      updatedBy: user.id,
    });

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Messaging route upserted successfully',
      data: row,
    };
  }

  /**
   * T020: List deliveries with filters (customer, policy, channel, status, pagination)
   */
  @Get('deliveries')
  async listDeliveries(
    @User() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
    @Query('policyId') policyId?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);

    const pageNum = parseInt(page ?? '1', 10);
    const pageSizeNum = parseInt(pageSize ?? '20', 10);
    const skip = (pageNum - 1) * pageSizeNum;

    const deliveries = await this.messagingService.listDeliveries({
      customerId,
      policyId,
      channel: channel as 'SMS' | 'EMAIL' | undefined,
      status: status as 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRY_WAIT' | undefined,
      skip,
      take: pageSizeNum,
    });

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Deliveries retrieved successfully',
      data: deliveries,
    };
  }

  /**
   * T020: Get delivery by ID
   */
  @Get('deliveries/:deliveryId')
  async getDelivery(
    @User() user: AuthenticatedUser,
    @Param('deliveryId') deliveryId: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);

    const delivery = await this.prisma.messagingDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        policy: { select: { id: true, policyNumber: true } },
        attachments: true,
        providerEvents: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!delivery) {
      throw new NotFoundException({
        error: { code: ErrorCodes.NOT_FOUND, message: `Delivery not found: ${deliveryId}` },
      });
    }

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Delivery retrieved successfully',
      data: delivery,
    };
  }

  /**
   * T026: Resend delivery (Support/Admin only)
   */
  @Post('deliveries/:deliveryId/resend')
  async resendDelivery(
    @User() user: AuthenticatedUser,
    @Param('deliveryId') deliveryId: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.assertSupportOrAdmin(user);

    const newDeliveryId = await this.messagingService.resendDelivery(deliveryId, correlationId ?? 'unknown');

    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Delivery resend queued successfully',
      data: { newDeliveryId },
    };
  }

  private assertSupportOrAdmin(user: AuthenticatedUser) {
    const roles = user?.roles ?? [];
    if (roles.includes('registration_admin') || roles.includes('support')) return;
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

