import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';
import { AppError } from '../utils/app-error';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Authentication required. Missing Bearer token.', 401));
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    next(new AppError('Authentication required. Empty Bearer token.', 401));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') {
      next(new AppError('Invalid token type.', 401));
      return;
    }
    req.user = payload;
    next();
  } catch {
    next(new AppError('Invalid or expired access token.', 401));
  }
}
