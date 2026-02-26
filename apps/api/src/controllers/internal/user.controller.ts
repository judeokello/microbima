import { Controller, Get, Param, HttpStatus, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SupabaseService } from '../../services/supabase.service';
import { CorrelationId } from '../../decorators/correlation-id.decorator';

/**
 * Internal User Controller
 *
 * Provides helper endpoints for user information
 */
@ApiTags('Internal - User Management')
@ApiBearerAuth()
@Controller('internal/users')
export class UserController {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get user display name by user ID
   * GET /internal/users/:userId/display-name
   */
  @Get(':userId/display-name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user display name',
    description: 'Retrieve the display name for a user from Supabase auth metadata.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID (Supabase UUID)',
    type: String,
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Display name retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'number', example: 200 },
        correlationId: { type: 'string' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            displayName: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUserDisplayName(
    @Param('userId') userId: string,
    @CorrelationId() correlationId?: string
  ) {
    try {
      // Get user from Supabase auth
      const { data: { user }, error } = await this.supabaseService
        .getClient()
        .auth.admin.getUserById(userId);

      if (error || !user) {
        // User not found (e.g. deleted from auth) - return 200 with Unknown User
        return {
          status: HttpStatus.OK,
          correlationId: correlationId ?? 'unknown',
          message: 'Display name retrieved successfully',
          data: {
            userId,
            displayName: 'Unknown User',
            email: '',
          },
        };
      }

      const userMetadata = user.user_metadata ?? {};
      const displayName = userMetadata.displayName ?? user.email ?? 'Unknown User';

      return {
        status: HttpStatus.OK,
        correlationId: correlationId ?? 'unknown',
        message: 'Display name retrieved successfully',
        data: {
          userId: user.id,
          displayName,
          email: user.email ?? '',
        },
      };
    } catch (error) {
      throw new Error(`Failed to get user display name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

