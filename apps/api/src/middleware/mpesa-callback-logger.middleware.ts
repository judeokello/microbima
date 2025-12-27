import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to log raw request body for M-Pesa callback endpoints
 * This helps debug validation issues by logging what M-Pesa actually sends
 */
@Injectable()
export class MpesaCallbackLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MpesaCallbackLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Only log for M-Pesa callback endpoints
    if (
      req.path === '/api/public/mpesa/stk-push/callback' ||
      req.path === '/api/public/mpesa/confirmation'
    ) {
      this.logger.debug(
        JSON.stringify({
          event: 'MPESA_CALLBACK_RAW_REQUEST',
          path: req.path,
          method: req.method,
          headers: {
            'content-type': req.headers['content-type'],
            'user-agent': req.headers['user-agent'],
          },
          body: req.body,
          timestamp: new Date().toISOString(),
        })
      );
    }

    next();
  }
}

