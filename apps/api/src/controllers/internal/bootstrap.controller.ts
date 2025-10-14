import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { seedBootstrapData } from '../../utils/seed-bootstrap-data';

@ApiTags('Bootstrap')
@Controller('internal/bootstrap')
export class BootstrapController {
  private readonly logger = new Logger(BootstrapController.name);

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

      // Seed the essential data
      await seedBootstrapData(body.userId);

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

