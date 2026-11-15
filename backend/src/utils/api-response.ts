import { Response } from 'express';

export interface ApiSuccessPayload<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorPayload {
  success: false;
  message: string;
  errors: Array<{ field?: string; message: string }>;
}

export function sendSuccess<T>(
  res: Response,
  message: string,
  data: T,
  meta: Record<string, unknown> = {},
  statusCode = 200
): Response<ApiSuccessPayload<T>> {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta
  });
}

export function sendError(
  res: Response,
  message: string,
  errors: Array<{ field?: string; message: string }> = [],
  statusCode = 400
): Response<ApiErrorPayload> {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
}
