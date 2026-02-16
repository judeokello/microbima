import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { Prisma } from '@prisma/client';

@ApiTags('Internal - Messaging')
@ApiBearerAuth()
@Controller('internal/messaging')
export class InternalMessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly systemSettings: SystemSettingsService,
    private readonly templates: MessagingTemplatesService,
    private readonly routes: MessagingRoutesService,
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

