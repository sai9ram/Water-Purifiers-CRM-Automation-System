import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import { loginSchema, refreshSchema, logoutSchema } from './auth.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rate-limit.middleware';
import { asyncHandler } from '../../utils/async-handler';

const router = Router();
const controller = new AuthController();

router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginSchema),
  asyncHandler(controller.login)
);

router.post(
  '/refresh',
  authRateLimiter,
  validateRequest(refreshSchema),
  asyncHandler(controller.refresh)
);

router.post(
  '/logout',
  authenticate,
  validateRequest(logoutSchema),
  asyncHandler(controller.logout)
);

router.get('/me', authenticate, asyncHandler(controller.me));

export const authRoutes = router;
