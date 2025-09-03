import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      apiKey?: string;
      partnerId?: string;
    }
  }
}
