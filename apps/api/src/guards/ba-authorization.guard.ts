import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import * as Sentry from '@sentry/nestjs';

export interface BAUser {
  id: string;
  roles: string[];
  baId?: string;
  partnerId?: number;
}

/**
 * BA Authorization Guard
 *
 * Validates that the authenticated user has the required roles and permissions
 * to access agent registration endpoints.
 */
@Injectable()
export class BAAuthorizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
      const allowBA = this.reflector.get<boolean>('allowBA', context.getHandler());
      const requireOwnership = this.reflector.get<boolean>('requireOwnership', context.getHandler());

      // If no roles specified, allow access
      if (!requiredRoles && !allowBA && !requireOwnership) {
        return true;
      }

      const request = context.switchToHttp().getRequest();
      const user = request.user as BAUser;

      if (!user) {
        throw new UnauthorizedException('Authentication required');
      }

      // Check if user has required roles
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role => user.roles.includes(role));
        if (!hasRequiredRole) {
          throw new ForbiddenException('Insufficient permissions');
        }
      }

      // Check if BA access is allowed and user is a BA
      if (allowBA && user.roles.includes('brand_ambassador')) {
        // Validate BA exists and is active
        if (user.baId) {
          const ba = await this.prisma.brandAmbassador.findFirst({
            where: {
              id: user.baId,
              isActive: true,
            },
          });

          if (!ba) {
            throw new ForbiddenException('Brand Ambassador not found or inactive');
          }

          // Store BA info in request for later use
          request.baInfo = {
            id: ba.id,
            partnerId: ba.partnerId,
            userId: ba.userId,
          };
        }
      }

      // Check ownership requirements
      if (requireOwnership) {
        const params = request.params;
        const baId = params.baId ?? params.id;

        if (user.roles.includes('brand_ambassador')) {
          // BAs can only access their own data
          if (user.baId !== baId) {
            throw new ForbiddenException('Access denied: Can only access own data');
          }
        } else if (user.roles.includes('registration_admin')) {
          // Admins can access data within their partner scope
          if (user.partnerId) {
            const ba = await this.prisma.brandAmbassador.findUnique({
              where: { id: baId },
              select: { partnerId: true },
            });

            if (ba && ba.partnerId !== user.partnerId) {
              throw new ForbiddenException('Access denied: Partner scope violation');
            }
          }
        }
      }

      return true;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'BAAuthorizationGuard.canActivate',
        },
        extra: {
          context: context.getHandler().name,
        },
      });

      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Authorization failed');
    }
  }
}
