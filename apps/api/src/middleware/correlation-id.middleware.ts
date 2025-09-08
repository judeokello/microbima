import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Correlation ID Middleware
 * 
 * Extracts correlation IDs from client requests for request tracing
 * This middleware should be applied to all routes for consistent tracing
 * 
 * Expected header: x-correlation-id: <correlation-id-value>
 * Required for all public API endpoints
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Debug logging
    console.log(`[CorrelationIdMiddleware] req.path: "${req.path}", req.originalUrl: "${req.originalUrl}"`);
    
    // Skip correlation ID requirement for internal API routes
    // Check both req.path and req.originalUrl to handle different routing scenarios
    const isInternalRoute = req.path.includes('/internal') || req.originalUrl.includes('/internal');
    
    console.log(`[CorrelationIdMiddleware] isInternalRoute: ${isInternalRoute}`);
    
    if (isInternalRoute) {
      console.log(`[CorrelationIdMiddleware] Skipping correlation ID for internal route`);
      return next();
    }

    // Skip correlation ID requirement for health check endpoints
    if (req.path === '/health' || req.path === '/api/health' || req.originalUrl === '/health' || req.originalUrl === '/api/health') {
      return next();
    }

    // Skip correlation ID requirement for Swagger documentation (in development)
    if (process.env.NODE_ENV === 'development' && req.path.startsWith('/api-docs')) {
      return next();
    }

    // Extract correlation ID from header
    const correlationIdHeader = req.headers['x-correlation-id'];
    const correlationId = Array.isArray(correlationIdHeader) 
      ? correlationIdHeader[0] 
      : correlationIdHeader as string;

    if (!correlationId) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'x-correlation-id header is required for request tracing',
        error: 'Bad Request',
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }

    // Validate correlation ID is not empty
    if (correlationId.trim() === '') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Correlation ID cannot be empty',
        error: 'Bad Request',
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
    
    // Add correlation ID to request object for access throughout the request lifecycle
    req['correlationId'] = correlationId;
    
    // Note: Correlation ID is set in response body by mappers, not in headers
    // to avoid duplication issues
    
    next();
  }


}
