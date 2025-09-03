import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

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
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Skip authentication for internal API routes
    if (req.path.startsWith('/api/internal')) {
      return next();
    }

    // Skip authentication for health check endpoints
    if (req.path === '/health' || req.path === '/api/health') {
      return next();
    }

    // Skip authentication for Swagger documentation (in development)
    if (process.env.NODE_ENV === 'development' && req.path.startsWith('/api-docs')) {
      return next();
    }

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

    // Validate the API key
    if (!this.isValidApiKey(apiKey)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid API key',
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Add the validated API key to the request for later use
    req['apiKey'] = apiKey;
    
    next();
  }

  /**
   * Validate the API key
   * @param apiKey - The API key from the request header
   * @returns boolean - True if valid, false otherwise
   */
  private isValidApiKey(apiKey: string): boolean {
    // For now, we'll use a simple validation
    // In production, this should validate against a database of valid API keys
    // and potentially check against a partner/tenant system
    
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic validation - API key should be at least 16 characters
    if (apiKey.length < 16) {
      return false;
    }

    // Check if it matches the expected format (alphanumeric with optional hyphens/underscores)
    const apiKeyRegex = /^[a-zA-Z0-9_-]+$/;
    if (!apiKeyRegex.test(apiKey)) {
      return false;
    }

    // TODO: In production, implement proper API key validation:
    // 1. Check against database of valid API keys
    // 2. Validate against partner/tenant system
    // 3. Check API key permissions/scopes
    // 4. Rate limiting per API key
    // 5. API key expiration/rotation

    return true;
  }


}
