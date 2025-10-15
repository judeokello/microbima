import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Bootstrap')
@Controller('internal/bootstrap')
export class BootstrapController {
  private readonly logger = new Logger(BootstrapController.name);

  constructor(private readonly prisma: PrismaService) {}

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

