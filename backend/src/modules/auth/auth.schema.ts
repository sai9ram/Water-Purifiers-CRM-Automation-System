import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Valid email address is required'),
    password: z.string().min(6, 'Password must be at least 6 characters')
  })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10, 'Refresh token is required')
  })
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10, 'Refresh token is required').optional()
  })
});
