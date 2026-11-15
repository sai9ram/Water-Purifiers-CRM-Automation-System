import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess } from '../../utils/api-response';

export class AuthController {
  private readonly service = new AuthService();

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.login(req.body, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null
    });
    sendSuccess(res, 'Authenticated successfully', result, {}, 200);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.refreshTokens(req.body.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null
    });
    sendSuccess(res, 'Token refreshed successfully', result, {}, 200);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.service.logout(req.user!.sub, req.body?.refreshToken);
    sendSuccess(res, 'Logged out successfully', {}, {}, 200);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.service.getCurrentUserProfile(req.user!.sub);
    sendSuccess(res, 'Current user profile retrieved successfully', profile, {}, 200);
  };
}
