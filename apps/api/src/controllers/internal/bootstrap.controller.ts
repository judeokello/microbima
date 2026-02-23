import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../services/supabase.service';

@ApiTags('Bootstrap')
@Controller('internal/bootstrap')
export class BootstrapController {
  private readonly logger = new Logger(BootstrapController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post('create-user')
  @ApiOperation({
    summary: 'Create bootstrap user with email auto-confirmation',
    description: 'Creates the first admin user with confirmed email. Returns user ID for subsequent operations.',
  })
  @ApiHeader({
    name: 'x-correlation-id',
    required: true,
    description: 'Correlation ID for request tracing',
  })
  @ApiResponse({
    status: 201,
    description: 'Bootstrap user created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        userId: { type: 'string', example: 'uuid-here' },
        email: { type: 'string', example: 'admin@example.com' },
      },
    },
  })
  async createBootstrapUser(
    @Body() body: { email: string; password: string; displayName: string; phone?: string },
    @Headers('x-correlation-id') correlationId: string,
  ) {
    try {
      this.logger.log(`[${correlationId}] Creating bootstrap user: ${body.email}`);

      // Create user with email auto-confirmation (T055: phone in user_metadata, default international format)
      const userResult = await this.supabase.createUser({
        email: body.email,
        password: body.password,
        userMetadata: {
          roles: ['registration_admin', 'brand_ambassador'],
          displayName: body.displayName,
          phone: body.phone ?? '254722000999',
        },
      });

      if (!userResult.success) {
        throw new Error(userResult.error);
      }

      const userId = userResult.data && typeof userResult.data === 'object' && 'id' in userResult.data ? (userResult.data as { id: string }).id : '';
      this.logger.log(`[${correlationId}] Bootstrap user created: ${userId}`);

      return {
        success: true,
        userId,
        email: body.email,
      };
    } catch (error: unknown) {
      this.logger.error(`[${correlationId}] Error creating bootstrap user:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  @Post('seed-initial-data')
  @ApiOperation({
    summary: 'Seed initial system data after bootstrap user creation',
    description: 'Seeds Maisha Poa partner and MfanisiGo product. Should be called once after creating the first admin user.',
  })
  @ApiHeader({
    name: 'x-correlation-id',
    required: true,
    description: 'Correlation ID for request tracing',
  })
  @ApiResponse({
    status: 201,
    description: 'Initial data seeded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Bootstrap data seeded successfully' },
        data: {
          type: 'object',
          properties: {
            partnerCreated: { type: 'string', example: 'Maisha Poa' },
            productCreated: { type: 'string', example: 'MfanisiGo' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or data already seeded',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async seedInitialData(
    @Body() body: { userId: string },
    @Headers('x-correlation-id') correlationId: string,
  ) {
    try {
      this.logger.log(`[${correlationId}] Seeding bootstrap data for user: ${body.userId}`);

      // Seed Maisha Poa partner
      await this.prisma.partner.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          partnerName: 'Maisha Poa',
          website: 'www.maishapoa.co.ke',
          officeLocation: 'Lotus Plaza, Parklands, Nairobi',
          isActive: true,
          createdBy: body.userId,
        },
      });

      this.logger.log(`[${correlationId}] Bootstrap data seeded successfully`);

      return {
        success: true,
        message: 'Bootstrap data seeded successfully',
        data: {
          partnerCreated: 'Maisha Poa (partnerId: 1)',
        },
      };
    } catch (error: unknown) {
      this.logger.error(
        `[${correlationId}] Error seeding bootstrap data:`,
        error instanceof Error ? error.message : String(error),
      );

      // If data already exists, that's okay (idempotent)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
      if (errorMessage?.includes('already exists') || errorCode === '23505') {
        return {
          success: true,
          message: 'Bootstrap data already exists',
          data: {
            partnerCreated: 'Maisha Poa (already exists)',
          },
        };
      }

      throw error;
    }
  }
}

