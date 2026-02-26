import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BootstrapUserService } from '../services/bootstrap-user.service';

/**
 * Guard that restricts access to the bootstrap (first) user only.
 * Returns 404 for non-root users to hide page existence.
 */
@Injectable()
export class RootOnlyGuard implements CanActivate {
  constructor(private readonly bootstrapUserService: BootstrapUserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string } | undefined;

    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const isRoot = await this.bootstrapUserService.isBootstrapUser(user.id);
    if (!isRoot) {
      throw new NotFoundException();
    }

    return true;
  }
}
