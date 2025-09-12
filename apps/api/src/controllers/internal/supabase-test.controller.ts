import { Controller, Post, Get, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseService } from '../../services/supabase.service';
import { CreatePartnerRequestDto } from '../../dto/partner-management/create-partner-request.dto';

@ApiTags('Supabase Test')
@Controller('internal/supabase-test')
export class SupabaseTestController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('connection')
  @ApiOperation({ 
    summary: 'Test Supabase Connection',
    description: 'Test if Supabase client can connect to the database'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Connection test result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' }
      }
    }
  })
  async testConnection() {
    const result = await this.supabaseService.testConnection();
    
    if (!result.success) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Supabase connection failed',
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Supabase connection successful',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('partners')
  @ApiOperation({ 
    summary: 'Create Partner (Supabase Client)',
    description: 'Create a new partner using Supabase client instead of Prisma'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Partner created successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 201 },
        message: { type: 'string', example: 'Partner created successfully' },
        data: { type: 'object' },
        timestamp: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Supabase connection failed',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 503 },
        message: { type: 'string', example: 'Supabase connection failed' },
        error: { type: 'string' },
        timestamp: { type: 'string' }
      }
    }
  })
  async createPartner(@Body() createPartnerDto: CreatePartnerRequestDto) {
    const result = await this.supabaseService.createPartner({
      partnerName: createPartnerDto.partnerName,
      website: createPartnerDto.website,
      officeLocation: createPartnerDto.officeLocation,
    });

    if (!result.success) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Failed to create partner via Supabase',
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Partner created successfully via Supabase',
      data: result.data,
      timestamp: new Date().toISOString(),
    };
  }
}
