import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerApiKey } from '../entities/partner-api-key.entity';

/**
 * API Key Authentication Middleware
 * 
 * Validates the x-api-key header for public API endpoints
 * This middleware should be applied to all public API routes
 * 
 * Expected header: x-api-key: <api-key-value>
 */
@Injectable()
export class ApiKeyAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    console.log('API Key Middleware - Request path:', req.path);
    console.log('API Key Middleware - Request method:', req.method);
    console.log('API Key Middleware - Request URL:', req.url);
    console.log('API Key Middleware - Request originalUrl:', req.originalUrl);
    
    // Skip authentication for internal API routes
    if (req.path.startsWith('/api/internal') || req.originalUrl.startsWith('/api/internal')) {
      console.log('Skipping API key auth for internal route:', req.path);
      return next();
    }

    // Skip authentication for health check endpoints
    if (req.path === '/health' || req.path === '/api/health' || req.originalUrl === '/health' || req.originalUrl === '/api/health') {
      console.log('Skipping API key auth for health check:', req.path);
      return next();
    }

    // Skip authentication for Swagger documentation (in development)
    if (process.env.NODE_ENV === 'development' && (req.path.startsWith('/api-docs') || req.originalUrl.startsWith('/api-docs'))) {
      console.log('Skipping API key auth for Swagger docs:', req.path);
      return next();
    }

    console.log('Applying API key auth for route:', req.path);

    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'API key is required',
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate the API key against database
    const validationResult = await this.validateApiKey(apiKey);
    
    if (!validationResult.valid) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: validationResult.message,
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Add the validated API key and partner ID to the request for later use
    req['apiKey'] = apiKey;
    req['partnerId'] = validationResult.partnerId;
    
    next();
  }

  /**
   * Validate the API key against database
   * @param apiKey - The API key from the request header
   * @returns ValidationResult with validation status and partner ID
   */
  private async validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    message: string;
    partnerId?: number;
  }> {
    // Basic format validation first
    if (!PartnerApiKey.validateApiKeyFormat(apiKey)) {
      return {
        valid: false,
        message: 'Invalid API key format',
      };
    }

    // Hash the API key for database lookup
    const hashedApiKey = PartnerApiKey.hashApiKey(apiKey);

    try {
      // Find the API key in the database
      const partnerApiKey = await this.prismaService.partnerApiKey.findFirst({
        where: {
          apiKey: hashedApiKey,
        },
        include: {
          partner: true, // Include partner data to check if partner is active
        },
      });

      // Check if API key exists
      if (!partnerApiKey) {
        return {
          valid: false,
          message: 'Invalid API key',
        };
      }

      // Check if API key is active
      if (!partnerApiKey.isActive) {
        return {
          valid: false,
          message: 'API key is inactive',
        };
      }

      // Check if the partner is active
      if (!partnerApiKey.partner.isActive) {
        return {
          valid: false,
          message: 'Partner is inactive',
        };
      }

      // All validations passed
      return {
        valid: true,
        message: 'API key is valid',
        partnerId: partnerApiKey.partnerId,
      };
    } catch (error) {
      // Log the error but don't expose internal details
      console.error('Error validating API key:', error);
      return {
        valid: false,
        message: 'Error validating API key',
      };
    }
  }


}
