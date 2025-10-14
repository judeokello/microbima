import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../services/supabase.service';

// Extend the Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  baId?: string;
  partnerId?: number;
}

@Injectable()
export class SupabaseAuthMiddleware implements NestMiddleware {
  constructor(private readonly supabaseService: SupabaseService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Only apply to internal API routes
    if (!req.path.startsWith('/api/internal')) {
      return next();
    }

    // Skip authentication for bootstrap endpoints (one-time setup before users exist)
    if (req.path.startsWith('/api/internal/bootstrap')) {
      console.log('Skipping Supabase auth for bootstrap endpoint:', req.path);
      return next();
    }

    console.log('Supabase Auth Middleware - Processing:', req.path);

    try {
      // Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No Bearer token found in Authorization header');
        throw new UnauthorizedException('Bearer token required');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log('Extracted token:', token.substring(0, 20) + '...');

      // Verify the JWT token with Supabase
      const { data: { user }, error } = await this.supabaseService
        .getClient()
        .auth.getUser(token);

      if (error || !user) {
        console.log('Token validation failed:', error?.message);
        throw new UnauthorizedException('Invalid token');
      }

      console.log('Token validated successfully for user:', user.email);

      // Extract user metadata
      const userMetadata = user.user_metadata || {};
      const roles = userMetadata.roles || [];

      // Create authenticated user object
      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email || '',
        roles,
        baId: userMetadata.baId,
        partnerId: userMetadata.partnerId ? parseInt(userMetadata.partnerId) : undefined,
      };

      // Set user in request for guards to access
      req['user'] = authenticatedUser;

      console.log('User authenticated:', {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        roles: authenticatedUser.roles,
        baId: authenticatedUser.baId,
        partnerId: authenticatedUser.partnerId,
      });

      next();
    } catch (error) {
      console.error('Supabase auth middleware error:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
