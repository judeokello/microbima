import { Controller, Post, Body, Headers, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../services/supabase.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Bootstrap')
@Controller('internal/bootstrap')
export class BootstrapController {
  private readonly logger = new Logger(BootstrapController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  @Post('create-user')
  @ApiOperation({
    summary: 'Create the first bootstrap admin user',
    description: 'Creates the first admin user with registration_admin and brand_ambassador roles. Can only be called once.',
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
        message: { type: 'string', example: 'Bootstrap user created successfully' },
        data: {
          type: 'object',
          properties: {
            userId: { type: 'string', example: 'uuid-here' },
            email: { type: 'string', example: 'admin@example.com' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bootstrap already completed or invalid request',
  })
  @ApiResponse({
    status: 403,
    description: 'Bootstrap is not enabled',
  })
  async createBootstrapUser(
    @Body() body: { email: string; password: string; displayName: string },
    @Headers('x-correlation-id') correlationId: string,
  ) {
    try {
      this.logger.log(`[${correlationId}] Bootstrap user creation requested for: ${body.email}`);

      // 1. Check if bootstrap is enabled
      const bootstrapEnabled = this.config.get<string>('ENABLE_BOOTSTRAP') === 'true';
      if (!bootstrapEnabled) {
        this.logger.warn(`[${correlationId}] Bootstrap is not enabled`);
        throw new ForbiddenException('Bootstrap is not enabled. Set ENABLE_BOOTSTRAP=true to enable.');
      }

      // 2. Check if any users already exist
      const { data: existingUsers, error: listError } = await this.supabase
        .getClient()
        .auth.admin.listUsers({ page: 1, perPage: 1 });

      if (listError) {
        this.logger.error(`[${correlationId}] Error checking existing users:`, listError);
        throw new BadRequestException('Failed to check existing users');
      }

      if (existingUsers && existingUsers.users && existingUsers.users.length > 0) {
        this.logger.warn(`[${correlationId}] Bootstrap already completed - users exist`);
        throw new BadRequestException(
          'Bootstrap user creation is not possible because it has already been completed. Users already exist in the system.',
        );
      }

      // 3. Create the bootstrap user
      const userResult = await this.supabase.createUser({
        email: body.email,
        password: body.password,
        userMetadata: {
          roles: ['registration_admin', 'brand_ambassador'],
          displayName: body.displayName,
        },
      });

      if (!userResult.success) {
        this.logger.error(`[${correlationId}] Failed to create user:`, userResult.error);
        throw new BadRequestException(`Failed to create user: ${userResult.error}`);
      }

      const userId = userResult.data.id;
      this.logger.log(`[${correlationId}] Bootstrap user created: ${userId}`);

      // 4. Seed initial data (Maisha Poa partner + MfanisiGo product)
      await this.prisma.partner.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          partnerName: 'Maisha Poa',
          website: 'www.maishapoa.co.ke',
          officeLocation: 'Lotus Plaza, Parklands, Nairobi',
          isActive: true,
          createdBy: userId,
        },
      });

      await this.prisma.$executeRaw`
        INSERT INTO "bundled_products" ("name", "description", "created_by")
        VALUES ('MfanisiGo', 'Owned by the OOD drivers', ${userId}::uuid)
        ON CONFLICT DO NOTHING
      `;

      this.logger.log(`[${correlationId}] Bootstrap completed successfully`);

      return {
        success: true,
        message: 'Bootstrap user created successfully',
        data: {
          userId: userId,
          email: body.email,
          partnerCreated: 'Maisha Poa (partnerId: 1)',
          productCreated: 'MfanisiGo',
        },
      };
    } catch (error: any) {
      this.logger.error(`[${correlationId}] Bootstrap error:`, error.message);
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
      const partner = await this.prisma.partner.upsert({
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

      // Seed MfanisiGo bundled product
      await this.prisma.$executeRaw`
        INSERT INTO "bundled_products" ("name", "description", "created_by")
        VALUES ('MfanisiGo', 'Owned by the OOD drivers', ${body.userId}::uuid)
        ON CONFLICT DO NOTHING
      `;

      this.logger.log(`[${correlationId}] Bootstrap data seeded successfully`);

      return {
        success: true,
        message: 'Bootstrap data seeded successfully',
        data: {
          partnerCreated: 'Maisha Poa (partnerId: 1)',
          productCreated: 'MfanisiGo',
        },
      };
    } catch (error: any) {
      this.logger.error(
        `[${correlationId}] Error seeding bootstrap data:`,
        error.message,
      );

      // If data already exists, that's okay (idempotent)
      if (error.message?.includes('already exists') || error.code === '23505') {
        return {
          success: true,
          message: 'Bootstrap data already exists',
          data: {
            partnerCreated: 'Maisha Poa (already exists)',
            productCreated: 'MfanisiGo (already exists)',
          },
        };
      }

      throw error;
    }
  }
}

