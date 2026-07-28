import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CorrelationId } from '../../decorators/correlation-id.decorator';
import { User } from '../../decorators/user.decorator';
import { AuthenticatedUser } from '../../types/express';
import { LctExportService } from '../../modules/lct/lct-export.service';
import { LCT_TEMPLATE_KEY } from '../../modules/lct/lct.types';

@ApiTags('Internal - LCT Exports')
@ApiBearerAuth()
@Controller('internal/lct-exports')
export class InternalLctExportsController {
  constructor(private readonly lctExportService: LctExportService) {}

  @Get('pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List pending LCT sync targets grouped by principal' })
  async getPending(
    @User() user: AuthenticatedUser,
    @CorrelationId() correlationId: string | undefined,
    @Query('name') name?: string,
    @Query('idNumber') idNumber?: string,
    @Query('memberNumber') memberNumber?: string,
    @Query('phone') phone?: string,
    @Query('product') product?: string
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.getPending({
      name,
      idNumber,
      memberNumber,
      phone,
      product,
    });
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Pending LCT exports retrieved',
      data,
    };
  }

  @Get('errors')
  @HttpCode(HttpStatus.OK)
  async getErrors(
    @User() user: AuthenticatedUser,
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.getErrors();
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'LCT export errors retrieved',
      data,
    };
  }

  @Get('batches')
  @HttpCode(HttpStatus.OK)
  async listBatches(
    @User() user: AuthenticatedUser,
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.listBatches();
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'LCT export batches retrieved',
      data,
    };
  }

  @Get('batches/:id')
  @HttpCode(HttpStatus.OK)
  async getBatch(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.getBatch(id);
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'LCT export batch retrieved',
      data,
    };
  }

  @Post('batches')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(
    @User() user: AuthenticatedUser,
    @Body() body: { syncTargetIds: string[] },
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.createBatch(
      body.syncTargetIds ?? [],
      user.id,
      correlationId ?? 'unknown'
    );
    return {
      status: HttpStatus.CREATED,
      correlationId: correlationId ?? 'unknown',
      message: 'LCT export batch created',
      data,
    };
  }

  @Post('batches/:id/send')
  @HttpCode(HttpStatus.OK)
  async sendBatch(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      toEmails?: string[];
      ccEmails?: string[];
      bccEmails?: string[];
      bodyHtml?: string;
      bodyText?: string;
    },
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.sendBatch(
      id,
      { id: user.id, email: user.email },
      body ?? {},
      correlationId ?? 'unknown'
    );
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'LCT export batch sent',
      data,
    };
  }

  @Post('batches/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBatch(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.cancelBatch(
      id,
      user.id,
      correlationId ?? 'unknown'
    );
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'LCT export batch cancelled',
      data,
    };
  }

  @Get('batches/:id/download')
  @HttpCode(HttpStatus.OK)
  async downloadBatch(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const { filename, buffer } = await this.lctExportService.downloadBatch(id);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('recipient-configs/:templateKey')
  @HttpCode(HttpStatus.OK)
  async getRecipientConfig(
    @User() user: AuthenticatedUser,
    @Param('templateKey') templateKey: string,
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.getRecipientConfig(
      templateKey || LCT_TEMPLATE_KEY
    );
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Recipient config retrieved',
      data,
    };
  }

  @Patch('recipient-configs/:templateKey')
  @HttpCode(HttpStatus.OK)
  async updateRecipientConfig(
    @User() user: AuthenticatedUser,
    @Param('templateKey') templateKey: string,
    @Body() body: { toEmails?: string[]; ccEmails?: string[]; bccEmails?: string[] },
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.updateRecipientConfig(
      templateKey || LCT_TEMPLATE_KEY,
      body,
      user.id
    );
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Recipient config updated',
      data,
    };
  }

  @Patch('policies/:policyId/staff-number')
  @HttpCode(HttpStatus.OK)
  async updateStaffNumber(
    @User() user: AuthenticatedUser,
    @Param('policyId') policyId: string,
    @Body() body: { staffNumber?: string | null },
    @CorrelationId() correlationId: string | undefined
  ) {
    this.lctExportService.assertAdmin(user.roles ?? []);
    const data = await this.lctExportService.updatePolicyStaffNumber(
      policyId,
      body.staffNumber ?? null,
      correlationId ?? 'unknown'
    );
    return {
      status: HttpStatus.OK,
      correlationId: correlationId ?? 'unknown',
      message: 'Staff number updated',
      data: { id: data.id, staffNumber: data.staffNumber },
    };
  }
}
