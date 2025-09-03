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
    if (req.path.startsWith('/api/internal')) {
      return next();
    }

    // Skip correlation ID requirement for health check endpoints
    if (req.path === '/health' || req.path === '/api/health') {
      return next();
    }

    // Skip correlation ID requirement for Swagger documentation (in development)
    if (process.env.NODE_ENV === 'development' && req.path.startsWith('/api-docs')) {
      return next();
    }

    // Extract correlation ID from header
    const correlationId = req.headers['x-correlation-id'] as string;

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
    
    // Add correlation ID to response headers for client tracking
    res.setHeader('x-correlation-id', correlationId);
    
    // Add correlation ID to response object for access in controllers/services
    res['correlationId'] = correlationId;
    
    next();
  }


}
