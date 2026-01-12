// Types for Express Request/Response extensions

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  baId?: string;
  partnerId?: number;
}

declare global {

  namespace Express {
    interface Request {
      apiKey?: string;
      partnerId?: number;
      correlationId: string; // Mandatory for all external requests
      userId?: string; // Will be set by auth middleware
      user?: AuthenticatedUser; // Set by Supabase auth middleware for internal API routes
    }

    interface Response {
      correlationId: string; // Always present in responses
    }
  }
}
