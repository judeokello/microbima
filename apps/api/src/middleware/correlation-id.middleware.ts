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
    // Skip correlation ID requirement for internal API routes
    // Check multiple path formats to handle different routing scenarios
    const path = req.path || '';
    const originalUrl = req.originalUrl || '';
    const url = req.url || '';
    
    const isInternalRoute = 
      path.includes('/internal') || 
      originalUrl.includes('/internal') || 
      url.includes('/internal') ||
      path.includes('/api/internal') || 
      originalUrl.includes('/api/internal') || 
      url.includes('/api/internal');
    
    if (isInternalRoute) {
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
    let correlationId = Array.isArray(correlationIdHeader) 
      ? correlationIdHeader[0] 
      : correlationIdHeader as string;

    // For internal routes, set a default correlation ID if none provided
    if (!correlationId && isInternalRoute) {
      correlationId = 'internal-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

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
