import { Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      apiKey?: string;
      partnerId?: string;
      correlationId: string; // Mandatory for all external requests
      userId?: string; // Will be set by auth middleware
    }
    
    interface Response {
      correlationId: string; // Always present in responses
    }
  }
}
