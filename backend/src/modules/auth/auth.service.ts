import { AuthRepository } from './auth.repository';
import { AuthTokensResponseDto, AuthUserDto, LoginDto } from './auth.dto';
import { verifyPassword } from '../../utils/password';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../../utils/jwt';
import { AppError } from '../../utils/app-error';
import { auditService } from '../audit/audit.service';

export class AuthService {
  private readonly repo = new AuthRepository();

  private extractRolesAndPermissions(user: NonNullable<Awaited<ReturnType<AuthRepository['findUserByEmail']>>>): {
    roles: string[];
    permissions: string[];
  } {
    const roleSet = new Set<string>();
    const permissionSet = new Set<string>();

    for (const ur of user.userRoles) {
      roleSet.add(ur.role.code);
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.code);
      }
    }

    return {
      roles: Array.from(roleSet),
      permissions: Array.from(permissionSet)
    };
  }

  async login(
    dto: LoginDto,
    meta?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<AuthTokensResponseDto> {
    const user = await this.repo.findUserByEmail(dto.email);
    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await auditService.log({
        actorUserId: user.id,
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user.id,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent
      });
      throw new AppError('Invalid email or password', 401);
    }

    const { roles, permissions } = this.extractRolesAndPermissions(user);

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      roles,
      permissions
    });

    const { token: refreshToken, expiresAt } = signRefreshToken(user.id);
    const tokenHash = hashToken(refreshToken);

    await this.repo.createRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null
    });

    await this.repo.updateLastLogin(user.id);

    await auditService.log({
      actorUserId: user.id,
      action: 'auth.login.success',
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        roles,
        permissions
      },
      accessToken,
      refreshToken
    };
  }

  async refreshTokens(
    rawRefreshToken: string,
    meta?: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<AuthTokensResponseDto> {
    let payload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    if (payload.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await this.repo.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      throw new AppError('Refresh token not recognized', 401);
    }

    if (storedToken.revokedAt) {
      // Token reuse detected: revoke all active sessions for this user
      await this.repo.revokeAllUserRefreshTokens(storedToken.userId);
      throw new AppError('Refresh token has already been used or revoked', 401);
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AppError('Refresh token expired', 401);
    }

    const user = await this.repo.findUserById(storedToken.userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError('User account is inactive', 401);
    }

    const { roles, permissions } = this.extractRolesAndPermissions(user);

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      roles,
      permissions
    });

    const { token: newRefreshToken, expiresAt } = signRefreshToken(user.id);
    const newTokenHash = hashToken(newRefreshToken);

    await this.repo.rotateRefreshToken(storedToken.id, {
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        roles,
        permissions
      },
      accessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(userId: string, rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await this.repo.revokeRefreshTokenByHash(tokenHash);
    } else {
      await this.repo.revokeAllUserRefreshTokens(userId);
    }

    await auditService.log({
      actorUserId: userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId
    });
  }

  async getCurrentUserProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.repo.findUserById(userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError('User not found or inactive', 404);
    }

    const { roles, permissions } = this.extractRolesAndPermissions(user);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      roles,
      permissions
    };
  }
}
