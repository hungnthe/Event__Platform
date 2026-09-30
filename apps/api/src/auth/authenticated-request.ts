import type { AuthUser } from '@eventflow/contracts';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
