export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthTokensResponseDto {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}
