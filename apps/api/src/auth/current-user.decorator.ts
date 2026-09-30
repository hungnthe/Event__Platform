import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { AuthException } from './auth.exception';
import type { AuthenticatedRequest } from './authenticated-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new AuthException(401, 'AUTH_SESSION_REQUIRED', 'Cần đăng nhập để tiếp tục.');
    }
    return request.user;
  },
);
