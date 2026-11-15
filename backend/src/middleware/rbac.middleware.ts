import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../utils/app-error';

export function requirePermissions(...requiredPermissions: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    if (req.user.roles.includes('OWNER_ADMIN')) {
      next();
      return;
    }

    const userPerms = new Set(req.user.permissions ?? []);
    const missing = requiredPermissions.filter(perm => !userPerms.has(perm));

    if (missing.length > 0) {
      next(
        new AppError(
          `Forbidden: missing required permission(s): ${missing.join(', ')}`,
          403
        )
      );
      return;
    }

    next();
  };
}

export function requireRoles(...allowedRoles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      next(new AppError('Forbidden: insufficient role privileges.', 403));
      return;
    }

    next();
  };
}
