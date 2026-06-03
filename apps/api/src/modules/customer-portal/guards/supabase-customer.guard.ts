import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCodes } from '../../../enums/error-codes.enum';
import { SupabaseService } from '../../../services/supabase.service';
import type { Request } from 'express';

@Injectable()
export class SupabaseCustomerGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTHENTICATION_ERROR,
        message: 'Missing or invalid bearer token',
      });
    }

    const token = header.slice('Bearer '.length).trim();
    const { data, error } = await this.supabaseService.getClient().auth.getUser(token);

    if (error || !data.user?.id) {
      throw new UnauthorizedException({
        code: ErrorCodes.AUTHENTICATION_ERROR,
        message: 'Invalid or expired session',
      });
    }

    const rolesUnknown = data.user.user_metadata?.['roles'];
    const roles = Array.isArray(rolesUnknown) ? rolesUnknown : [];
    if (!roles.map(String).includes('customer')) {
      throw new ForbiddenException({
        code: ErrorCodes.INSUFFICIENT_PERMISSIONS,
        message: 'Customer portal access requires customer role',
      });
    }

    request.customerPortalUserId = data.user.id;
    return true;
  }
}
